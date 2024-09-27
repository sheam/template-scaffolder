import { confirm, input, number, search, select } from '@inquirer/prompts';
import { getPathQuestion } from './path.js';
import { getSearchQuestion } from './search.js';
import { MANUAL_ENTRY_VALUE } from './types.js';
import {
  isConfirmQuestion,
  isInputQuestion,
  isNumberQuestion,
  isPathSelectQuestion,
  isSearchQuestion,
  isSelectQuestion,
} from '../types/helpers.js';
import { Question } from '../types/index.js';

export async function prompt<TResult extends object>(
  questions: Question[]
): Promise<TResult> {
  const answers = new Array<(string | number | boolean | undefined)[]>();
  for (const question of questions) {
    if (question.when) {
      if (!question.when(Object.fromEntries(answers) as TResult)) {
        continue;
      }
    }
    if (isInputQuestion(question)) {
      answers.push([question.name, await input(question)]);
    } else if (isConfirmQuestion(question)) {
      answers.push([question.name, await confirm(question)]);
    } else if (isNumberQuestion(question)) {
      answers.push([question.name, await number(question)]);
    } else if (isSelectQuestion(question)) {
      answers.push([question.name, await select(question)]);
    } else if (isSearchQuestion(question)) {
      answers.push([question.name, await search(getSearchQuestion(question))]);
    } else if (isPathSelectQuestion(question)) {
      const pathQuestion = await getPathQuestion(question);
      const answer = await search(pathQuestion);
      if (answer === MANUAL_ENTRY_VALUE) {
        answers.push([
          question.name,
          await input({ ...question, message: 'enter path' }),
        ]);
      } else {
        answers.push([question.name, answer]);
      }
    } else {
      throw new Error(`Unsupported question type: ${JSON.stringify(question)}`);
    }
  }
  return Object.fromEntries(answers) as TResult;
}
