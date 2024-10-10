import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { LAST_RUN_CONFIG_NAME } from './constants.js';
import { log, logError } from './logger.js';
import {
  ICliArgs,
  IFinalizedInputs,
  ILastRunConfig,
  IPromptResult,
} from './types/index.js';
import { existsAsync } from './util.js';

const LAST_RUN_CONFIG_PATH = path.join(process.cwd(), LAST_RUN_CONFIG_NAME);
const FORMAT_VERSION = '1.0';

export async function saveLastRun(
  cliArgs: ICliArgs,
  finalizedInputs: IFinalizedInputs<never>
): Promise<void> {
  const promptResults = new Array<IPromptResult>();
  for (const k of Object.keys(finalizedInputs.answers)) {
    promptResults.push({
      name: k,
      answer: finalizedInputs.answers[k] ?? null,
    });
  }
  const lastRunConfig: ILastRunConfig = {
    lastRunConfigFormatVersion: FORMAT_VERSION,
    name: finalizedInputs.instanceName,
    args: cliArgs,
    destination: finalizedInputs.destination,
    promptResults,
  };
  const data = JSON.stringify(lastRunConfig, null, 2);
  await writeFile(LAST_RUN_CONFIG_PATH, data);
  log(`saved last run config at ${LAST_RUN_CONFIG_PATH}`, 0, true);
  log(data, 0, true);
}

export async function loadLastRun(): Promise<ILastRunConfig> {
  log('loading last run data');
  const lastRunConfigExists = await existsAsync(LAST_RUN_CONFIG_PATH);
  if (!lastRunConfigExists) {
    logError('no last run config exist');
    process.exit(-1);
  }
  const data = await readFile(LAST_RUN_CONFIG_PATH, 'utf-8');
  const config = JSON.parse(data) as ILastRunConfig;
  if (config.lastRunConfigFormatVersion !== FORMAT_VERSION) {
    logError(
      `store last run configuration is version '${config.lastRunConfigFormatVersion}' which does not match the current version '${FORMAT_VERSION}'.`
    );
    process.exit(-1);
  }

  log(`using last run config for ${config.name}`, 1);
  return config;
}
