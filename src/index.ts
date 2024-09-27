#!/usr/bin/env node

import { getArgs } from './cli.js';
import { getConfig } from './config.js';
import { processTemplates } from './templateProcessing/index.js';
import { getInitialInputs, finalizeInputs } from './userInputs.js';
import { log, printValues, verifyScaffoldingFolder } from './util.js';

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

await verifyScaffoldingFolder();

const args = getArgs();
const initialValues = await getInitialInputs(args);
const config = await getConfig(initialValues);
const finalizedInputs = await finalizeInputs(config, args, initialValues);

// log('Using co n figuration:', 0, !args.dryRun);
// console.log ( JS ON.stringify(finalizedInputs, undefined, 4));
printValues(finalizedInputs, args.dryRun, 1);

const start = new Date().getTime();
log('Creating files:');
const count = await processTemplates(finalizedInputs, args.dryRun);
const end = new Date().getTime();
const elapsed = (end - start) / 1000;
log(`Created ${count} files in ${elapsed}s`);
