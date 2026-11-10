import type { ILastRun } from './lastRun.js';
import type { Answers } from './types.js';

/** Options for a run, from the command line or a programmatic caller. */
export interface IRunOptions {
  /** Template folder name, or the `name` in its config. Asked for if missing. */
  template?: string;
  /** Instance name (the NAME variable). Asked for if missing. */
  name?: string;
  /** Destination directory, relative to the project root. */
  destination?: string;
  /** Render everything but write nothing and run no commands. */
  dryRun?: boolean;
  /** Replace existing files instead of skipping them. */
  overwrite?: boolean;
  /** Run afterFileCreated commands for different files concurrently. */
  parallel?: boolean;
  /** Replay the previous run's template, name, destination and answers. */
  rerun?: boolean;
  /** Pre-supplied answers by question name; those questions are not asked. */
  answers?: Answers;
  /** Save this run for `rerun`. Default true on the command line, false for `scaffold()`. */
  saveLastRun?: boolean;
}

export interface IResolvedOptions {
  template?: string;
  name?: string;
  destination?: string;
  dryRun: boolean;
  overwrite: boolean;
  parallel: boolean;
  answers: Answers;
}

/**
 * Merge explicit options with the previous run. Explicit options always win,
 * so `--rerun --name=Other` replays everything except the name.
 */
export function resolveOptions(
  options: IRunOptions,
  lastRun: ILastRun | null
): IResolvedOptions {
  return {
    template: options.template || lastRun?.template || undefined,
    name: options.name || lastRun?.name || undefined,
    destination: options.destination || lastRun?.destination || undefined,
    dryRun: options.dryRun ?? lastRun?.dryRun ?? false,
    overwrite: options.overwrite ?? lastRun?.overwrite ?? false,
    parallel: options.parallel ?? lastRun?.parallel ?? false,
    answers: { ...(lastRun?.answers ?? {}), ...(options.answers ?? {}) },
  };
}
