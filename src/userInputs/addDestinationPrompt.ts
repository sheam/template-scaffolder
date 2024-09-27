import { existsSync, statSync } from 'fs';
import { IChoice, Question } from '../types/index.js';
import { logError } from '../util.js';
import { IInitialPromptResult } from './types.js';

/**
 * Add a prompt to get destination directory to existing question list.
 */
export function addDestinationPrompt<TInput extends object>(
  srcRoot: string,
  destinations: string[] | string | undefined,
  questions: Question<TInput & IInitialPromptResult>[]
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
