import { IInitialPromptResult } from './types.js';
import { getBuiltIns } from '../builtIns.js';
import { addDestinationPrompt } from './addDestinationPrompt.js';
import { getSrcRoot } from './getSrcRoot.js';
import { prompt } from '../prompts/index.js';
import {
  ICliArgs,
  IFinalizedInputs,
  IInitialInputs,
  ILastRunConfig,
  MacroObject,
  Question,
  TemplateVariables,
} from '../types/index.js';
import { isDirectory } from '../util.js';

/**
 * Determine the values missing from command line and config file,
 * and prompt user for what we can't determine a reasonable default for.
 * This should be run after getInitialInputs(). and getConfig().
 * @param cliValues command line options.
 * @param requiredInputs what we were able to determine from the getInitialInputs function.
 * @param lastRunConfig values used for the previous run, null if should not be honoured.
 */
export async function finalizeInputs<TInput extends object>(
  cliValues: ICliArgs,
  requiredInputs: IInitialInputs<TInput>,
  lastRunConfig: ILastRunConfig | null
): Promise<IFinalizedInputs<TInput>> {
  const config = requiredInputs.template.config;
  const srcRoot = await getSrcRoot(config);
  const questions: Question<TInput & IInitialPromptResult>[] = [];

  if (typeof config.prompts === 'function') {
    const promptQuestions = await config.prompts(requiredInputs.instanceName);
    promptQuestions.forEach(p => questions.push(p));
  } else if (Array.isArray(config.prompts)) {
    config.prompts.forEach(p => questions.push(p));
  }

  const hardCodedDestination =
    lastRunConfig?.destination ||
    cliValues.destination ||
    (typeof config.destinations === 'string' ? config.destinations : '');

  if (!hardCodedDestination) {
    await addDestinationPrompt(srcRoot, config.destinations, questions);
  }

  const answers = await prompt<IInitialPromptResult & TInput>(
    questions,
    lastRunConfig?.promptResults
  );

  const destination = answers.destination || hardCodedDestination;

  const isDestinationDirectory = await isDirectory(destination);
  if (!isDestinationDirectory) {
    throw new Error(`destination '${destination}' is not a valid directory`);
  }

  const builtIns = await getBuiltIns(config, requiredInputs);

  const configVariables =
    typeof config.variables === 'function'
      ? await config.variables(
          requiredInputs.instanceName,
          Object.assign({}, builtIns as TemplateVariables, answers as TInput)
        )
      : config.variables || {};

  const configMacros =
    typeof config.macros === 'function'
      ? await config.macros(
          requiredInputs.instanceName,
          Object.assign({}, builtIns as TemplateVariables, answers as TInput)
        )
      : ((config.macros || {}) as MacroObject);

  return {
    destination,
    srcRoot,
    afterFileCreated: config.afterFileCreated,
    createNameDir:
      config.createNameDir === true || config.createNameDir === undefined,
    template: requiredInputs.template,
    instanceName: requiredInputs.instanceName,
    variables: Object.assign({}, builtIns.variables, answers, configVariables),
    macros: Object.assign({}, builtIns.macros, configMacros) as MacroObject,
    stripLines: config.stripLines,
    overwrite: cliValues.overwrite === true,
    answers,
  };
}
