import { existsSync } from 'fs';
import { stat } from 'node:fs/promises';
import { IInitialPromptResult } from './types.js';
import { getBuiltIns } from '../builtIns.js';
import { addDestinationPrompt } from './addDestinationPrompt.js';
import { getSrcRoot } from './getSrcRoot.js';
import { prompt } from '../prompts/index.js';
import {
  ICliArgs,
  IConfigFile,
  IFinalizedInputs,
  IInitialInputs,
  Question,
  TemplateVariables,
} from '../types/index.js';

/**
 * Determine the values missing from command line and config file,
 * and prompt user for what we can't determine a reasonable default for.
 * This should be run after getInitialInputs(). and getConfig().
 * @param config config file options.
 * @param cliValues command line options.
 * @param requiredInputs what we were able to determine from the getInitialInputs function.
 */
export async function finalizeInputs<TInput extends object>(
  config: IConfigFile<TInput>,
  cliValues: ICliArgs,
  requiredInputs: IInitialInputs
): Promise<IFinalizedInputs<TInput>> {
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
          Object.assign({}, builtIns as TemplateVariables, answers as TInput)
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
