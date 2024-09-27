#!/usr/bin/env node

import { getArgs } from './cli';
import { getConfig } from './config';
import { createTemplates } from './templateProcessing';
import { getInitialInputs, finalizeInputs } from './userInputs';
import { log, printValues, verifyScaffoldingFolder } from './util';

// @ts-expect-error needed for node versions before v18
if (!Array.prototype.findLastIndex) {
  // @ts-expect-error needed for node versions before v18
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
