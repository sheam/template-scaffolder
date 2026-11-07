import path from 'node:path';
import { sourceRegistry } from '../source/api.js';
import { collectAnswers } from './answers.js';
import { getBuiltIns } from './builtIns.js';
import { createConfigLoader, type IConfigLoader } from './configLoader.js';
import { ScaffolderError } from './errors.js';
import { runShellCommand } from './exec.js';
import { generateFiles, runCommands } from './generate.js';
import { loadLastRun, saveLastRun } from './lastRun.js';
import {
  type IResolvedOptions,
  type IRunOptions,
  resolveOptions,
} from './options.js';
import {
  DEFAULT_SRC_ROOT,
  includesDir,
  isDirectory,
  toPosix,
} from './paths.js';
import { planFiles } from './plan.js';
import { validateQuestions } from './questions.js';
import {
  discoverTemplates,
  findTemplate,
  type ITemplate,
  templateTitle,
  verifyScaffoldingFolder,
} from './templates.js';
import type { INormalizedConfig } from './config.js';
import type { CommandRunner, IPrompter, IReporter } from './ports.js';
import type {
  Answers,
  ICommandResult,
  IFileResult,
  IPromptsContext,
  Question,
  TemplateVariables,
} from './types.js';

export interface IRunDeps {
  /** Folder containing `scaffolding/`. Relative paths in configs resolve against it. */
  projectRoot: string;
  prompter: IPrompter;
  reporter: IReporter;
  configLoader?: IConfigLoader;
  runCommand?: CommandRunner;
}

export interface IRunResult {
  template: string;
  name: string;
  destination: string;
  dryRun: boolean;
  variables: TemplateVariables;
  answers: Answers;
  files: IFileResult[];
  /** Commands returned by hooks.afterRun. */
  afterRunCommands: ICommandResult[];
  /** True if any file or command failed. */
  hasErrors: boolean;
}

const OTHER_DESTINATION = '\0other';

/**
 * One scaffolding run: pick the template, ask questions, render and write files, run hooks.
 * Never exits the process or writes to the console; failures throw ScaffolderError.
 */
export async function run(
  options: IRunOptions,
  deps: IRunDeps
): Promise<IRunResult> {
  const { projectRoot, prompter, reporter } = deps;
  const loader = deps.configLoader ?? createConfigLoader();
  const runCommand = deps.runCommand ?? runShellCommand;

  await verifyScaffoldingFolder(projectRoot);
  sourceRegistry.reset(projectRoot);

  const lastRun = options.rerun ? await loadLastRun(projectRoot) : null;
  if (lastRun)
    reporter.info(`replaying the previous run of '${lastRun.template}'`);
  const opts = resolveOptions(options, lastRun);

  const template = await selectTemplate(opts, { ...deps, loader });
  const { config } = template;
  config.readers.forEach(r => sourceRegistry.register(r));

  const name =
    opts.name ??
    ((await prompter.ask({
      type: 'input',
      name: 'name',
      message: 'Enter the name:',
      required: true,
    })) as string);
  if (!name) throw new ScaffolderError('MISSING_ANSWER', 'A name is required.');

  const builtins = await getBuiltIns(config, name);
  const promptsCtx: IPromptsContext = {
    name,
    builtins,
    source: sourceRegistry,
  };
  const { questions, warnings } = validateQuestions(
    await config.prompts(promptsCtx),
    config.name
  );
  warnings.forEach(w => reporter.warn(`${template.dir}: ${w}`));

  const answers = await collectAnswers(questions, {
    prompter,
    reporter,
    prior: opts.answers,
  });
  const destination = await resolveDestination(opts, config, {
    projectRoot,
    prompter,
  });

  const variablesCtx = { ...promptsCtx, answers };
  await config.hooks.beforeRun?.(variablesCtx);
  const variables: TemplateVariables = {
    ...builtins,
    ...answers,
    ...(await config.variables(variablesCtx)),
  };
  const macros = await config.macros({ ...variablesCtx, variables });
  reporter.debug(`variables: ${JSON.stringify(variables, debugReplacer, 2)}`);

  const plans = await planFiles({
    projectRoot,
    templatePath: template.path,
    destination,
    name,
    createNameDir: config.createNameDir,
    ignore: config.ignore,
    overwrite: opts.overwrite,
    variables,
  });

  const files = await generateFiles(plans, {
    projectRoot,
    includesDir: includesDir(projectRoot),
    variables,
    macros,
    stripLines: config.stripLines,
    hooks: config.hooks,
    dryRun: opts.dryRun,
    parallel: opts.parallel,
    runCommand,
    reporter,
  });

  const afterRunCommands = await runAfterRun(files, {
    config,
    destination,
    variables,
    dryRun: opts.dryRun,
    projectRoot,
    runCommand,
  });

  if (!options.rerun) {
    const saved = await saveLastRun(projectRoot, {
      template: template.dir,
      name,
      destination,
      dryRun: opts.dryRun,
      overwrite: opts.overwrite,
      parallel: opts.parallel,
      answers,
    });
    reporter.debug(`saved answers to ${saved} (replay with --rerun)`);
  }

  const failedCommand = (c: ICommandResult): boolean =>
    c.exitCode !== null && c.exitCode !== 0;
  return {
    template: template.dir,
    name,
    destination,
    dryRun: opts.dryRun,
    variables,
    answers,
    files,
    afterRunCommands,
    hasErrors:
      files.some(f => f.status === 'error' || f.commands.some(failedCommand)) ||
      afterRunCommands.some(failedCommand),
  };
}

async function selectTemplate(
  opts: IResolvedOptions,
  deps: IRunDeps & { loader: IConfigLoader }
): Promise<ITemplate> {
  const templateDeps = {
    projectRoot: deps.projectRoot,
    loader: deps.loader,
    reporter: deps.reporter,
    parallel: opts.parallel,
  };
  if (opts.template) return findTemplate(opts.template, templateDeps);

  const templates = await discoverTemplates(templateDeps);
  if (templates.length === 0) {
    throw new ScaffolderError(
      'TEMPLATE_NOT_FOUND',
      'No template could be loaded.'
    );
  }
  const dir = (await deps.prompter.ask({
    type: 'select',
    name: 'template',
    message: 'Select the template:',
    choices: templates.map(t => ({ value: t.dir, name: templateTitle(t) })),
    required: true,
  })) as string;
  const chosen = templates.find(t => t.dir === dir);
  if (!chosen)
    throw new ScaffolderError(
      'TEMPLATE_NOT_FOUND',
      `Unknown template '${dir}'.`
    );
  return chosen;
}

/** CLI/rerun value, then the config's fixed destination, then ask. Always validated. */
async function resolveDestination(
  opts: IResolvedOptions,
  config: INormalizedConfig,
  deps: { projectRoot: string; prompter: IPrompter }
): Promise<string> {
  let destination = opts.destination ?? config.destination;
  if (!destination) {
    destination = (await deps.prompter.ask(
      await destinationQuestion(config, deps.projectRoot)
    )) as string;
    if (destination === OTHER_DESTINATION) {
      destination = (await deps.prompter.ask(
        pathQuestion(await srcRoot(config, deps.projectRoot))
      )) as string;
    }
  }
  if (!(await isDirectory(path.resolve(deps.projectRoot, destination)))) {
    throw new ScaffolderError(
      'DESTINATION_INVALID',
      `Destination '${destination}' is not an existing directory.`
    );
  }
  return toPosix(destination);
}

async function destinationQuestion(
  config: INormalizedConfig,
  projectRoot: string
): Promise<Question> {
  if (config.destinations?.length) {
    const choices = [];
    for (const d of config.destinations) {
      if (await isDirectory(path.resolve(projectRoot, d)))
        choices.push({ value: d, name: d });
    }
    choices.push({ value: OTHER_DESTINATION, name: 'Other' });
    return {
      type: 'select',
      name: 'destination',
      message: 'Select a destination directory:',
      choices,
      required: true,
    };
  }
  return pathQuestion(await srcRoot(config, projectRoot));
}

function pathQuestion(rootPath: string): Question {
  return {
    type: 'path',
    name: 'destination',
    message: 'Enter a destination directory:',
    rootPath,
    itemType: 'directory',
    allowManualInput: true,
    required: true,
    excludePath: p =>
      (p.isDir && p.name === 'node_modules') || p.name.startsWith('.'),
  };
}

async function srcRoot(
  config: INormalizedConfig,
  projectRoot: string
): Promise<string> {
  if (config.srcRoot) return config.srcRoot;
  return (await isDirectory(path.resolve(projectRoot, DEFAULT_SRC_ROOT)))
    ? DEFAULT_SRC_ROOT
    : '.';
}

async function runAfterRun(
  files: IFileResult[],
  input: {
    config: INormalizedConfig;
    destination: string;
    variables: TemplateVariables;
    dryRun: boolean;
    projectRoot: string;
    runCommand: CommandRunner;
  }
): Promise<ICommandResult[]> {
  const hook = input.config.hooks.afterRun;
  if (!hook) return [];
  const commands = await hook({
    files,
    createdPaths: files
      .filter(f => f.status === 'created' || f.status === 'overwritten')
      .map(f => f.path),
    destination: input.destination,
    dryRun: input.dryRun,
    variables: input.variables,
  });
  return runCommands(commands, input);
}

function debugReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'function' ? '[function]' : value;
}
