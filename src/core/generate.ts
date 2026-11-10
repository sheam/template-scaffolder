import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { mapConcurrent } from './concurrency.js';
import { errorMessage } from './errors.js';
import { renderTemplateFile } from './render.js';
import type { IFilePlan } from './plan.js';
import type { CommandRunner, IReporter } from './ports.js';
import type {
  HookCommands,
  ICommandResult,
  IFileResult,
  IHookContext,
  IHooks,
  MacroObject,
  PatternList,
  TemplateVariables,
} from './types.js';

export interface IGenerateInput {
  projectRoot: string;
  includesDir: string;
  variables: TemplateVariables;
  macros: MacroObject;
  stripLines: PatternList;
  strictVariables: boolean;
  keepLineBreaks: boolean;
  hooks: IHooks;
  /** Passed to afterFileCreated, with the file's path and the variables. */
  hookContext: IHookContext;
  /** Run afterFileCreated commands for different files concurrently. */
  parallel: boolean;
  runCommand: CommandRunner;
  reporter: IReporter;
}

/**
 * Render every planned file, write them, and run afterFileCreated hooks.
 * Rendering is concurrent; writes are always sequential; hook commands for different
 * files run concurrently with `parallel`. Results are reported in template order.
 * A failing file does not stop the others.
 */
export async function generateFiles(
  plans: IFilePlan[],
  input: IGenerateInput
): Promise<IFileResult[]> {
  const report = orderedReporter<IFileResult>(plans.length, r =>
    input.reporter.file(r)
  );
  const { dryRun } = input.hookContext;

  // Rendering only reads files, so it is always safe to do concurrently.
  const rendered = await mapConcurrent(plans, plan => renderOne(plan, input), {
    parallel: true,
  });

  for (const [i, result] of rendered.entries()) {
    if (dryRun || result.status === 'skipped' || result.status === 'error')
      continue;
    try {
      await mkdir(path.dirname(plans[i].absolutePath), { recursive: true });
      await writeFile(plans[i].absolutePath, result.content ?? '');
    } catch (e) {
      Object.assign(result, {
        status: 'error',
        reason: `write failed: ${errorMessage(e)}`,
      });
    }
  }

  return mapConcurrent(
    rendered,
    async (result, i) => {
      if (result.status === 'created' || result.status === 'overwritten') {
        await runFileHook(result, input);
      }
      report(i, result);
      return result;
    },
    { parallel: input.parallel }
  );
}

async function renderOne(
  plan: IFilePlan,
  input: IGenerateInput
): Promise<IFileResult> {
  const base = {
    templateFile: plan.templateFile,
    path: plan.path,
    dryRun: input.hookContext.dryRun,
    warnings: [],
    commands: [],
  };
  if (plan.action === 'skip') {
    return {
      ...base,
      status: 'skipped',
      reason: 'already exists (use --overwrite)',
    };
  }
  try {
    const { output, unresolved } = await renderTemplateFile({
      sourcePath: plan.sourcePath,
      includesDir: input.includesDir,
      variables: { ...input.variables, CURRENT_FILE_PATH: plan.path },
      macros: input.macros,
      stripLines: input.stripLines,
      keepLineBreaks: input.keepLineBreaks,
    });
    const unknown = unknownVariables([...plan.unresolved, ...unresolved]);
    if (unknown && input.strictVariables) {
      return { ...base, status: 'error', reason: unknown };
    }
    return {
      ...base,
      status: plan.action === 'overwrite' ? 'overwritten' : 'created',
      content: output,
      warnings: unknown ? [unknown] : [],
    };
  } catch (e) {
    return { ...base, status: 'error', reason: errorMessage(e) };
  }
}

/** "unknown variables $A, $B (escape a literal $ as \$)", or undefined if there are none. */
function unknownVariables(references: string[]): string | undefined {
  const unique = [...new Set(references)];
  if (unique.length === 0) return undefined;
  const noun = unique.length === 1 ? 'variable' : 'variables';
  return `unknown ${noun} ${unique.join(', ')} (escape a literal $ as \\$)`;
}

async function runFileHook(
  result: IFileResult,
  input: IGenerateInput
): Promise<void> {
  const hook = input.hooks.afterFileCreated;
  if (!hook) return;
  try {
    const commands = await hook({
      ...input.hookContext,
      path: result.path,
      variables: input.variables,
    });
    result.commands = await runCommands(commands, {
      dryRun: input.hookContext.dryRun,
      projectRoot: input.projectRoot,
      runCommand: input.runCommand,
    });
  } catch (e) {
    result.status = 'error';
    result.reason = `afterFileCreated hook failed: ${errorMessage(e)}`;
  }
}

/** Run hook commands one after another (never in a dry run). */
export async function runCommands(
  commands: HookCommands,
  input: { dryRun: boolean; projectRoot: string; runCommand: CommandRunner }
): Promise<ICommandResult[]> {
  const results: ICommandResult[] = [];
  for (const command of Array.isArray(commands) ? commands : []) {
    if (input.dryRun) {
      results.push({ command, exitCode: null, output: '' });
      continue;
    }
    results.push({
      command,
      ...(await input.runCommand(command, { cwd: input.projectRoot })),
    });
  }
  return results;
}

/** Emit results in index order even when they complete out of order. */
function orderedReporter<T>(
  count: number,
  emit: (item: T) => void
): (index: number, item: T) => void {
  const done = new Array<T | undefined>(count);
  let next = 0;
  return (index, item) => {
    done[index] = item;
    while (next < count && done[next] !== undefined) emit(done[next++] as T);
  };
}
