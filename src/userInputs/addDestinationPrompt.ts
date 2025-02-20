import { IInitialPromptResult } from './types.js';
import { logError } from '../logger.js';
import { IChoice, Question } from '../types/index.js';
import { isDirectory } from '../util.js';

/**
 * Add a prompt to get destination directory to existing question list.
 */
export async function addDestinationPrompt<TInput extends object>(
  srcRoot: string,
  destinations: string[] | string | undefined,
  questions: Question<TInput & IInitialPromptResult>[]
): Promise<void> {
  // log(`destinations:${JSON.stringify(destinations)}`);
  if (Array.isArray(destinations)) {
    const destinationChoices = new Array<IChoice>();
    for (const path of destinations) {
      if (await isDirectory(path)) {
        destinationChoices.push({ value: path, name: path });
      } else {
        logError(`destination path '${path}' is not a valid directory`);
      }
    }

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
