import { getConfig } from '../config/index.js';
import { getInputResponse } from '../prompts/input.js';
import { ICliArgs, IInitialInputs } from '../types/index.js';

/**
 * Setup config based on command line values.
 * Determine which template we are going to use so that we can read the file later.
 * @param cliValues values acquired from the command line.
 */
export async function getInitialInputs<TInput extends object>(
  cliValues: ICliArgs
): Promise<IInitialInputs<TInput>> {
  const templateDescriptor = await getConfig(cliValues);

  let inputName = '';
  if (!cliValues.name) {
    inputName = await getInputResponse({
      name: 'name',
      type: 'input',
      message: 'Enter the name: ',
      required: true,
    });
  }

  const result: IInitialInputs<TInput> = {
    instanceName: inputName || cliValues.name || '',
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
