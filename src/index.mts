import {getArgs} from './cli.js';
import {getConfig} from './config.js';
import {createTemplates} from './templateProcessing.js';
import {getInitialInputs, getOtherInputs} from './userInputs.js';
import {log, printValues} from './util.js';

const args = getArgs();
const initialValues = await getInitialInputs(args);
const config = await getConfig(initialValues);
const otherInputs = await getOtherInputs(config, args);
const variables = Object.assign({}, initialValues, config.variables, otherInputs);

log('initialValues', 0, true);
printValues(initialValues, true);

log('config.variables', 0, true);
printValues(config.variables, true);

log('other inputs', 0, true);
printValues(otherInputs, true);

log('Using template variables:');
printValues(variables, true);

log('Creating files:');
await createTemplates(config, variables, args.dryRun);

