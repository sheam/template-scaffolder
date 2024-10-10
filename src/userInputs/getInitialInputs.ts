import { getConfig } from '../config/index.js';
import { getInputResponse } from '../prompts/input.js';
import { ICliArgs, IInitialInputs, ILastRunConfig } from '../types/index.js';

/**
 * Setup config based on command line values.
 * Determine which template we are going to use so that we can read the file later.
 * @param cliValues values acquired from the command line.
 * @param lastRunConfig values used for the previous run, null if should not be honoured.
 */
export async function getInitialInputs<TInput extends object>(
  cliValues: ICliArgs,
  lastRunConfig: ILastRunConfig | null
): Promise<IInitialInputs<TInput>> {
  const templateDescriptor = await getConfig(cliValues, lastRunConfig);

  let inputName = '';
  if (!cliValues.name && !lastRunConfig?.name) {
    inputName = await getInputResponse({
      name: 'name',
      type: 'input',
      message: 'Enter the name: ',
      required: true,
    });
  }

  const result: IInitialInputs<TInput> = {
    instanceName: inputName || lastRunConfig?.name || cliValues.name || '',
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
