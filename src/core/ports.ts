/**
 * The core's only connections to the outside world. The CLI implements these with
 * inquirer and the console; tests and programmatic callers can supply their own.
 */
import type { IFileResult, Question } from './types.js';

export interface IPrompter {
  /** Ask one question and return the answer (string, number, boolean or string[]). */
  ask(question: Question): Promise<unknown>;
}

export interface IReporter {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  /** Only shown with --debug / DEBUG=true. */
  debug(message: string): void;
  /** Called once per template file, in template order, after it is written (or skipped). */
  file(result: IFileResult): void;
}

/** Runs a shell command from a hook. */
export type CommandRunner = (
  command: string,
  options: { cwd: string }
) => Promise<{ exitCode: number | null; output: string }>;
