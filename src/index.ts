/**
 * template-scaffolder: programmatic API and types for template authors.
 * Importing this module has no side effects.
 */
import { createConfigLoader } from './core/configLoader.js';
import { ScaffolderError } from './core/errors.js';
import { type IRunResult, run } from './core/run.js';
import { discoverTemplates } from './core/templates.js';
import type { IRunOptions } from './core/options.js';
import type { IPrompter, IReporter } from './core/ports.js';
import type { Answers, Question } from './core/types.js';

export interface IScaffoldOptions extends IRunOptions {
  /** Folder containing `scaffolding/`. Defaults to the current working directory. */
  projectRoot?: string;
  /** How unanswered questions are asked. Defaults to `createAnswerPrompter()` (no interaction). */
  prompter?: IPrompter;
  /** Where progress goes. Defaults to a silent reporter. */
  reporter?: IReporter;
}

/**
 * Run a template from code.
 *
 * ```ts
 * const result = await scaffold({
 *   template: 'component', name: 'Button', destination: 'src/components',
 *   answers: { STYLE: 'css' },
 * });
 * ```
 * Questions without an entry in `answers` use their default, or fail with MISSING_ANSWER.
 * Pass `prompter: createConsolePrompter()` to ask in the terminal instead.
 */
export function scaffold(options: IScaffoldOptions): Promise<IRunResult> {
  const { projectRoot, prompter, reporter, ...runOptions } = options;
  return run(
    { saveLastRun: false, ...runOptions },
    {
      projectRoot: projectRoot ?? process.cwd(),
      prompter: prompter ?? createAnswerPrompter(),
      reporter: reporter ?? silentReporter,
    }
  );
}

/** A prompter that never interacts: it answers from `answers`, then question defaults. */
export function createAnswerPrompter(answers: Answers = {}): IPrompter {
  return {
    async ask(question: Question) {
      if (Object.hasOwn(answers, question.name)) return answers[question.name];
      if ('default' in question && question.default !== undefined)
        return question.default;
      if (question.type === 'confirm') return false;
      if (question.type === 'checkbox' || question.type === 'words') return [];
      if (!question.required && question.type !== 'select') return undefined;
      throw new ScaffolderError(
        'MISSING_ANSWER',
        `No answer for '${question.name}' (${question.message.trim()}). Pass it in 'answers'.`
      );
    },
  };
}

export interface ITemplateInfo {
  /** Folder name under `scaffolding/`. */
  dir: string;
  /** The config's `name`, or the folder name. */
  name: string;
  description?: string;
  version: string;
}

/**
 * Every template that loads, sorted by folder name. Templates whose config fails to
 * load are left out, with a warning to `reporter`.
 */
export async function listTemplates(
  options: { projectRoot?: string; reporter?: IReporter } = {}
): Promise<ITemplateInfo[]> {
  const templates = await discoverTemplates({
    projectRoot: options.projectRoot ?? process.cwd(),
    loader: createConfigLoader(),
    reporter: options.reporter ?? silentReporter,
    parallel: true,
  });
  return templates.map(({ dir, config }) => ({
    dir,
    name: config.name,
    description: config.description,
    version: config.version,
  }));
}

const silentReporter: IReporter = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  file() {},
};

export { defineConfig } from './core/config.js';
export {
  ScaffolderError,
  UserCancelledError,
  type ErrorCode,
} from './core/errors.js';
export { createConsolePrompter } from './cli/prompter.js';
export { createConsoleReporter } from './cli/reporter.js';
export type { IRunOptions } from './core/options.js';
export type { IRunResult } from './core/run.js';
export type { IPrompter, IReporter, CommandRunner } from './core/ports.js';
export type * from './core/types.js';
export type * from './source/types.js';
export {
  defineSourceReader,
  readSource,
  readSources,
  registerSourceReader,
} from './source/api.js';
