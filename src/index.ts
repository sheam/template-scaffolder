#!/usr/bin/env node

import { getArgs } from './cli.js';
import { log } from './logger.js';
import { loadLastRun, saveLastRun } from './rerun.js';
import { processTemplates } from './templateProcessing/index.js';
import { ILastRunConfig } from './types/index.js';
import { finalizeInputs, getInitialInputs } from './userInputs/index.js';
import { printValues, verifyScaffoldingFolder } from './util.js';

// hack for older versions of Node, remove after forcing version 18
if (!Array.prototype.findLastIndex) {
  Array.prototype.findLastIndex = function (predicate) {
    for (let i = this.length - 1; i >= 0; i--) {
      if (predicate(this[i], i, this)) {
        return i;
      }
    }
    return -1;
  };
}

const args = getArgs();
const lastRunConfig: ILastRunConfig | null = args.rerun
  ? await loadLastRun()
  : null;

await verifyScaffoldingFolder();

if (args.workDir) {
  log(`using working directory: ${args.workDir}`);
  process.chdir(args.workDir);
}
log(`working directory: ${process.cwd()}`, 0, true);
const initialValues = await getInitialInputs<never>(args, lastRunConfig);
const finalizedInputs = await finalizeInputs<never>(
  args,
  initialValues,
  lastRunConfig
);

const IS_DEBUG = process.env.DEBUG === 'true';
const IS_DRY_RUN = args.dryRun || lastRunConfig?.args.dryRun || false;
if (IS_DEBUG || IS_DRY_RUN) {
  printValues(finalizedInputs, 1);
}

await processTemplates(
  finalizedInputs,
  args.parallel || lastRunConfig?.args.parallel || false,
  IS_DRY_RUN
);

if (!args.rerun) {
  await saveLastRun(args, finalizedInputs);
}
log('Done');
