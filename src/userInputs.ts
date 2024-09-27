/* eslint-disable max-lines */
import { existsSync, statSync } from 'fs';
import { stat } from 'node:fs/promises';
import { getBuiltIns } from './builtIns.js';
import { getTemplateDescriptors } from './config.js';
import { DEFAULT_SRC_ROOT } from './constants.js';
import { prompt } from './prompt.js';
import {
  ICliArgs,
  IConfigFile,
  IInitialInputs,
  IFinalizedInputs,
  ITemplateDescriptor,
  Question,
  IChoice,
} from './types.js';
import { logError } from './util.js';

interface IInitialPromptResult {
  template?: string;
  name?: string;
  destination?: string;
}

/**
 * Setup config based on command line values.
 * Determine which template we are going to use so that we can read the file later.
 * @param cliValues values acquired from the command line.
 */
export async function getInitialInputs(
  cliValues: ICliArgs
): Promise<IInitialInputs> {
  const questions: Question[] = [];
  const templates = await getTemplateDescriptors();
  let templateDescriptor: ITemplateDescriptor | undefined = undefined;
  if (cliValues.template) {
    templateDescriptor =
      templates.find(td => td.name === cliValues.template) ||
      templates.find(td => td.dir === cliValues.template);

    if (!templateDescriptor) {
      logError(`Could not find template ${cliValues.template}`);
      process.exit(-1);
    }
  } else {
    const getTitle = (td: ITemplateDescriptor): string => {
      const s = td.name || td.dir;
      if (!td.description) return s;
      return `${s} - ${td.description.substring(0, 50)}`;
    };
    const templateChoices = templates.map(td => ({
      value: td.dir,
      name: getTitle(td),
    }));
    questions.push({
      name: 'template',
      type: 'select',
      choices: templateChoices,
      message: 'Select a template: ',
      required: true,
    });
  }

  if (!cliValues.name) {
    questions.push({
      name: 'name',
      type: 'input',
      message: 'Enter the name: ',
      required: true,
    });
  }

  const userInputs =
    questions.length > 0
      ? await prompt<IInitialPromptResult>(questions)
      : ({} as IInitialPromptResult);

  if (userInputs.template) {
    templateDescriptor =
      templates.find(td => td.name === userInputs.template) ||
      templates.find(td => td.dir === userInputs.template);
  }

  if (!templateDescriptor) {
    throw new Error(`Missing template ${cliValues.template}`);
  }

  const result: IInitialInputs = {
    instanceName: userInputs.name || cliValues.name || '',
    template: templateDescriptor,
  };

  if (!result.template)
    throw new Error(
      'template must be defined on command line or in user input'
    );
  if (!result.instanceName)
    throw new Error(
      'instance name must be defined on command line or in user input'
    );

  return result;
}

/**
 * Determine the values missing from command line and config file,
 * and prompt user for what we can't determine a reasonable default for.
 * This should be run after getInitialInputs(). and getConfig().
 * @param config config file options.
 * @param cliValues command line options.
 * @param requiredInputs what we were able to determine from the getInitialInputs function.
 */
export async function finalizeInputs(
  config: IConfigFile,
  cliValues: ICliArgs,
  requiredInputs: IInitialInputs
): Promise<IFinalizedInputs> {
  const srcRoot = getSrcRoot(config);
  const questions: Question[] = [];

  let hardCodedDestination = '';
  if (typeof config.destinations === 'string') {
    if (
      existsSync(config.destinations) &&
      (await stat(config.destinations)).isDirectory()
    ) {
      hardCodedDestination = config.destinations;
    } else {
      throw new Error(
        `destination '${config.destinations}' is not a valid directory`
      );
    }
  }

  if (!cliValues.destination && !hardCodedDestination) {
    addDestinationPrompt(srcRoot, config.destinations, questions);
  }

  if (typeof config.prompts === 'function') {
    config.prompts(requiredInputs.instanceName).forEach(p => questions.push(p));
  }

  if (Array.isArray(config.prompts)) {
    config.prompts.forEach(p => questions.push(p));
  }

  const answers = await prompt<IInitialPromptResult>(questions);

  const destination =
    answers.destination || cliValues.destination || hardCodedDestination;

  const builtIns = await getBuiltIns(config, requiredInputs);

  const configVariables =
    typeof config.variables === 'function'
      ? config.variables(
          requiredInputs.instanceName,
          Object.assign({}, builtIns, answers)
        )
      : config.variables || {};

  return {
    destination,
    srcRoot,
    afterFileCreated: config.afterFileCreated,
    createNameDir:
      config.createNameDir === true || config.createNameDir === undefined,
    template: requiredInputs.template,
    instanceName: requiredInputs.instanceName,
    variables: Object.assign({}, builtIns.variables, answers, configVariables),
    macros: Object.assign(config.macros || {}, builtIns.macros),
    stripLines: config.stripLines,
    overwrite: cliValues.overwrite === true,
  };
}

/**
 * Add a prompt to get destination directory to existing question list.
 */
function addDestinationPrompt(
  srcRoot: string,
  destinations: string[] | string | undefined,
  questions: Question[]
): void {
  function dirValidator(path: string): boolean {
    if (existsSync(path) && statSync(path).isDirectory()) return true;
    logError(`destination path '${path}' is not a valid directory`);
    return false;
  }

  if (Array.isArray(destinations)) {
    const destinationChoices = destinations
      .filter(p => dirValidator(p))
      .map<IChoice>(x => ({ value: x, title: x }));

    destinationChoices.push({ value: '__other__', name: 'Other' });
    questions.push({
      name: 'destination',
      message: 'Select a destination directory:',
      choices: destinationChoices,
      type: 'select',
      required: true,
    });
  } else {
    // log(`srcRoot=[${srcRoot}]`);
    questions.push({
      name: 'destination',
      message: `Enter a destination directory:`,
      type: 'path',
      rootPath: srcRoot,
      itemType: 'directory',
      allowManualInput: true,
      required: true,
      excludePath: pathInfo =>
        (pathInfo.isDir && pathInfo.name === 'node_modules') ||
        pathInfo.name.startsWith('.'),
    });
  }
}

function getSrcRoot(config: IConfigFile): string {
  if (config.srcRoot) {
    return config.srcRoot;
  }
  if (existsSync(DEFAULT_SRC_ROOT)) {
    return DEFAULT_SRC_ROOT;
  }
  return process.cwd();
}
