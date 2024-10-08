import { IInitialPromptResult } from './types.js';
import { getBuiltIns } from '../builtIns.js';
import { addDestinationPrompt } from './addDestinationPrompt.js';
import { getSrcRoot } from './getSrcRoot.js';
import { prompt } from '../prompts/index.js';
import {
  ICliArgs,
  IFinalizedInputs,
  IInitialInputs,
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
 */
export async function finalizeInputs<TInput extends object>(
  cliValues: ICliArgs,
  requiredInputs: IInitialInputs<TInput>
): Promise<IFinalizedInputs<TInput>> {
  const config = requiredInputs.template.config;
  const srcRoot = await getSrcRoot(config);
  const questions: Question<TInput & IInitialPromptResult>[] = [];

  let hardCodedDestination = '';
  if (typeof config.destinations === 'string') {
    if (await isDirectory(config.destinations)) {
      hardCodedDestination = config.destinations;
    } else {
      throw new Error(
        `destination '${config.destinations}' is not a valid directory`
      );
    }
  }

  if (!cliValues.destination && !hardCodedDestination) {
    // console.log(`NO CLI DESTINATION OR HARDCODED DESTINATION`);
    // console.log(`config.destinations: ${JSON.stringify(config.destinations)}`);
    // console.log(JSON.stringify(config, undefined, 2));
    // console.log('------------------------------');
    await addDestinationPrompt(srcRoot, config.destinations, questions);
  }

  if (typeof config.prompts === 'function') {
    const promptQuestions = await config.prompts(requiredInputs.instanceName);
    promptQuestions.forEach(p => questions.push(p));
  }

  if (Array.isArray(config.prompts)) {
    config.prompts.forEach(p => questions.push(p));
  }

  const answers = await prompt<IInitialPromptResult & TInput>(questions);

  const destination =
    answers.destination || cliValues.destination || hardCodedDestination;

  const builtIns = await getBuiltIns(config, requiredInputs);

  const configVariables =
    typeof config.variables === 'function'
      ? await config.variables(
          requiredInputs.instanceName,
          Object.assign({}, builtIns as TemplateVariables, answers as TInput)
        )
      : config.variables || {};

  // console.log(
  //   `CONFIG AFTER builtins and prompts = ${JSON.stringify(config, null, 2)}`
  // );
  // process.exit(-99);
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
