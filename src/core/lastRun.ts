import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ScaffolderError } from './errors.js';
import { exists, LAST_RUN_FILE_NAME } from './paths.js';
import type { Answers } from './types.js';

const FORMAT_VERSION = '2.0';

/** What `--rerun` replays. */
export interface ILastRun {
  template: string;
  name: string;
  destination: string;
  dryRun: boolean;
  overwrite: boolean;
  parallel: boolean;
  answers: Answers;
}

interface ILastRunFileV2 extends ILastRun {
  lastRunConfigFormatVersion: '2.0';
}

/** The 2.x format, still readable. */
interface ILastRunFileV1 {
  lastRunConfigFormatVersion: '1.0';
  name: string;
  destination: string;
  args: {
    template?: string;
    dryRun?: boolean;
    overwrite?: boolean;
    parallel?: boolean;
  };
  promptResults: Array<{ name: string; answer: unknown }>;
}

export function lastRunPath(projectRoot: string): string {
  return path.join(projectRoot, LAST_RUN_FILE_NAME);
}

export async function saveLastRun(
  projectRoot: string,
  run: ILastRun
): Promise<string> {
  const file = lastRunPath(projectRoot);
  const data: ILastRunFileV2 = {
    lastRunConfigFormatVersion: FORMAT_VERSION,
    ...run,
  };
  await writeFile(file, JSON.stringify(data, null, 2));
  return file;
}

export async function loadLastRun(projectRoot: string): Promise<ILastRun> {
  const file = lastRunPath(projectRoot);
  if (!(await exists(file))) {
    throw new ScaffolderError(
      'LAST_RUN_MISSING',
      `--rerun needs a previous run, but ${file} does not exist.`
    );
  }
  let data: unknown;
  try {
    data = JSON.parse(await readFile(file, 'utf-8'));
  } catch (e) {
    throw new ScaffolderError(
      'LAST_RUN_INVALID',
      `${file} is not valid JSON.`,
      { cause: e }
    );
  }
  return parseLastRun(data, file);
}

export function parseLastRun(
  data: unknown,
  file = LAST_RUN_FILE_NAME
): ILastRun {
  type AnyVersion = Partial<
    Omit<ILastRunFileV1, 'lastRunConfigFormatVersion'> &
      Omit<ILastRunFileV2, 'lastRunConfigFormatVersion'>
  > & { lastRunConfigFormatVersion?: string };
  const d = data as AnyVersion | null;
  switch (d?.lastRunConfigFormatVersion) {
    case '2.0':
      return {
        template: d.template ?? '',
        name: d.name ?? '',
        destination: d.destination ?? '',
        dryRun: d.dryRun === true,
        overwrite: d.overwrite === true,
        parallel: d.parallel === true,
        answers: d.answers ?? {},
      };
    case '1.0':
      return {
        template: d.args?.template ?? '',
        name: d.name ?? '',
        destination: d.destination ?? '',
        dryRun: d.args?.dryRun === true,
        overwrite: d.args?.overwrite === true,
        parallel: d.args?.parallel === true,
        answers: Object.fromEntries(
          (d.promptResults ?? [])
            // 2.x stored the destination answer as a prompt result too
            .filter(r => r.name !== 'destination')
            .map(r => [r.name, r.answer])
        ),
      };
    default:
      throw new ScaffolderError(
        'LAST_RUN_INVALID',
        `${file} has unknown format version '${String(d?.lastRunConfigFormatVersion)}'. Delete it and run without --rerun.`
      );
  }
}
