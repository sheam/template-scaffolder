#!/usr/bin/env node

import { getArgs } from './cli.js';
import { getConfig } from './config.js';
import { createTemplates } from './templateProcessing.js';
import { getInitialInputs, finalizeInputs } from './userInputs.js';
import { log, printValues, verifyScaffoldingFolder } from './util.js';

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

log('Creating files:');
await createTemplates(finalizedInputs, args.dryRun);
