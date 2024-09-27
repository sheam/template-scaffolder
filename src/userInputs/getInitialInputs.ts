import { getTemplateDescriptors } from '../config.js';
import { prompt } from '../prompts/index.js';
import {
  ICliArgs,
  IInitialInputs,
  ITemplateDescriptor,
  Question,
} from '../types/index.js';
import { logError } from '../util.js';
import { IInitialPromptResult } from './types.js';

/**
 * Setup config based on command line values.
 * Determine which template we are going to use so that we can read the file later.
 * @param cliValues values acquired from the command line.
 */
export async function getInitialInputs(
  cliValues: ICliArgs
): Promise<IInitialInputs> {
  const questions: Question[] = [];
  const templates = await getTemplateDescriptors(cliValues.parallel);
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
