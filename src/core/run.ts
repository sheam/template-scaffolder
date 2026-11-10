import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { sourceRegistry } from '../source/api.js';
import { collectAnswers, priorAnswer } from './answers.js';
import { getBuiltIns } from './builtIns.js';
import { createConfigLoader, type IConfigLoader } from './configLoader.js';
import { errorMessage, ScaffolderError } from './errors.js';
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
  exists,
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
  IHookContext,
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
    reporter,
  });

  const variablesCtx = { ...promptsCtx, answers };
  const hookContext: IHookContext = {
    ...variablesCtx,
    destination,
    dryRun: opts.dryRun,
  };
  await callHook('beforeRun', () => config.hooks.beforeRun?.(hookContext));
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
    strictVariables: config.strictVariables,
    keepLineBreaks: config.keepLineBreaks,
    hooks: config.hooks,
    hookContext,
    parallel: opts.parallel,
    runCommand,
    reporter,
  });

  const afterRunCommands = await runAfterRun(files, {
    config,
    hookContext,
    variables,
    projectRoot,
    runCommand,
  });

  if (options.saveLastRun !== false && !options.rerun) {
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
    // Loading configs has no shared state, so it is always concurrent.
    parallel: true,
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

/**
 * CLI/rerun value, then the config's fixed destination, then ask.
 * A destination that does not exist is created if the user agrees (not in a dry run).
 */
async function resolveDestination(
  opts: IResolvedOptions,
  config: INormalizedConfig,
  deps: { projectRoot: string; prompter: IPrompter; reporter: IReporter }
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
  const absolute = path.resolve(deps.projectRoot, destination);
  if (await isDirectory(absolute)) return toPosix(destination);
  if (await exists(absolute)) {
    throw new ScaffolderError(
      'DESTINATION_INVALID',
      `Destination '${destination}' is a file, not a directory.`
    );
  }
  const question: Question = {
    type: 'confirm',
    name: 'createDestination',
    message: `'${destination}' does not exist. Create it?`,
    default: true,
  };
  // Scripts answer it like any other question: --answer createDestination=yes.
  const create = Object.hasOwn(opts.answers, question.name)
    ? priorAnswer(question, opts.answers[question.name])
    : await deps.prompter.ask(question);
  if (!create) {
    throw new ScaffolderError(
      'DESTINATION_INVALID',
      `Destination '${destination}' does not exist.`
    );
  }
  if (opts.dryRun) {
    deps.reporter.info(`would create ${toPosix(destination)}`);
  } else {
    await mkdir(absolute, { recursive: true });
    deps.reporter.info(`created ${toPosix(destination)}`);
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
      const found = await isDirectory(path.resolve(projectRoot, d));
      choices.push({ value: d, name: found ? d : `${d} (new)` });
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
    hookContext: IHookContext;
    variables: TemplateVariables;
    projectRoot: string;
    runCommand: CommandRunner;
  }
): Promise<ICommandResult[]> {
  const hook = input.config.hooks.afterRun;
  if (!hook) return [];
  const commands = await callHook('afterRun', () =>
    hook({
      ...input.hookContext,
      files,
      createdPaths: files
        .filter(f => f.status === 'created' || f.status === 'overwritten')
        .map(f => f.path),
      variables: input.variables,
    })
  );
  return runCommands(commands, {
    dryRun: input.hookContext.dryRun,
    projectRoot: input.projectRoot,
    runCommand: input.runCommand,
  });
}

/** Run a beforeRun/afterRun hook, naming the hook in any error it throws. */
async function callHook<T>(
  hook: 'beforeRun' | 'afterRun',
  fn: () => T | Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ScaffolderError) throw e;
    throw new ScaffolderError(
      'HOOK_FAILED',
      `hooks.${hook}: ${errorMessage(e)}`,
      { cause: e }
    );
  }
}

function debugReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'function' ? '[function]' : value;
}
