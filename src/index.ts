#!/usr/bin/env node

import { getArgs } from './cli.js';
import { processTemplates } from './templateProcessing/index.js';
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

await verifyScaffoldingFolder();

const args = getArgs();
const initialValues = await getInitialInputs(args);
const finalizedInputs = await finalizeInputs(args, initialValues);

// log('Using co n figuration:', 0, !args.dryRun);
// console.log ( JS ON.stringify(finalizedInputs, undefined, 4));
printValues(finalizedInputs, args.dryRun, 1);

await processTemplates(
  finalizedInputs,
  args.parallel || false,
  args.dryRun || false
);
