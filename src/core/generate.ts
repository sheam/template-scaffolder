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
  hooks: IHooks;
  dryRun: boolean;
  parallel: boolean;
  runCommand: CommandRunner;
  reporter: IReporter;
}

/**
 * Render every planned file, write them, and run afterFileCreated hooks.
 * Rendering and hook commands run concurrently with --parallel; writes are always
 * sequential. Results are reported in template order. A failing file does not stop the others.
 */
export async function generateFiles(
  plans: IFilePlan[],
  input: IGenerateInput
): Promise<IFileResult[]> {
  const report = orderedReporter<IFileResult>(plans.length, r =>
    input.reporter.file(r)
  );

  const rendered = await mapConcurrent(plans, plan => renderOne(plan, input), {
    parallel: input.parallel,
  });

  for (const [i, result] of rendered.entries()) {
    if (
      input.dryRun ||
      result.status === 'skipped' ||
      result.status === 'error'
    )
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
    dryRun: input.dryRun,
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
    const content = await renderTemplateFile({
      sourcePath: plan.sourcePath,
      includesDir: input.includesDir,

      variables: { ...input.variables, CURRENT_FILE_PATH: plan.path },
      macros: input.macros,
      stripLines: input.stripLines,
    });
    return {
      ...base,
      status: plan.action === 'overwrite' ? 'overwritten' : 'created',
      content,
    };
  } catch (e) {
    return { ...base, status: 'error', reason: errorMessage(e) };
  }
}

async function runFileHook(
  result: IFileResult,
  input: IGenerateInput
): Promise<void> {
  const hook = input.hooks.afterFileCreated;
  if (!hook) return;
  try {
    const commands = await hook({
      path: result.path,
      dryRun: input.dryRun,
      variables: input.variables,
    });
    result.commands = await runCommands(commands, input);
  } catch (e) {
    result.status = 'error';
    result.reason = `afterFileCreated hook failed: ${errorMessage(e)}`;
  }
}

/** Run hook commands one after another (never in a dry run). */
export async function runCommands(
  commands: HookCommands,
  input: Pick<IGenerateInput, 'dryRun' | 'projectRoot' | 'runCommand'>
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
