import { IInitialPromptResult } from './types.js';
import { getConfig } from '../config/index.js';
import { prompt } from '../prompts/index.js';
import { ICliArgs, IInitialInputs, Question } from '../types/index.js';

/**
 * Setup config based on command line values.
 * Determine which template we are going to use so that we can read the file later.
 * @param cliValues values acquired from the command line.
 */
export async function getInitialInputs<TInput extends object>(
  cliValues: ICliArgs
): Promise<IInitialInputs<TInput>> {
  const templateDescriptor = await getConfig(cliValues);

  const questions: Question<IInitialPromptResult>[] = [];
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

  const result: IInitialInputs<TInput> = {
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
