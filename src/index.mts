#!/usr/bin/env node

import {getArgs} from './cli.js';
import {getConfig} from './config.js';
import {createTemplates} from './templateProcessing.js';
import {getInitialInputs, finalizeInputs} from './userInputs.js';
import {log, printValues, verifyScaffoldingFolder} from './util.js';

verifyScaffoldingFolder();

const args = getArgs();
const initialValues = await getInitialInputs(args);
const config = await getConfig(initialValues);
const finalizedInputs = await finalizeInputs(config, args, initialValues);

log('finalized variables', 0, true);
printValues(finalizedInputs, true, 1);

log('Creating files:');
await createTemplates(finalizedInputs, args.dryRun);

