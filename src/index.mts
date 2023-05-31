#!/usr/bin/env node

import {getArgs} from './cli.js';
import {getConfig} from './config.js';
import {createTemplates} from './templateProcessing.js';
import {getInitialInputs, finalizeInputs} from './userInputs.js';
import {getUserName, log, printValues, verifyScaffoldingFolder} from './util.js';

verifyScaffoldingFolder();

const args = getArgs();
const initialValues = await getInitialInputs(args);
const config = await getConfig(initialValues);
const finalizedInputs = await finalizeInputs(config, args, initialValues);


// log('Using configuration:', 0, !args.dryRun);
// console.log(JSON.stringify(finalizedInputs, undefined, 4));
printValues(finalizedInputs, args.dryRun, 1);

log('Creating files:');
await createTemplates(finalizedInputs, args.dryRun);

