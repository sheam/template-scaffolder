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

export async function prompt<TInput extends object>(
  questions: Question<TInput>[]
): Promise<TInput> {
  const answers = new Array<(string | number | boolean | undefined)[]>();
  for (const question of questions) {
    if (question.when) {
      if (!question.when(Object.fromEntries(answers) as TInput)) {
        continue;
      }
    }
    if (isInputQuestion(question)) {
      answers.push([question.name.toString(), await input(question)]);
    } else if (isConfirmQuestion(question)) {
      answers.push([question.name.toString(), await confirm(question)]);
    } else if (isNumberQuestion(question)) {
      answers.push([question.name.toString(), await number(question)]);
    } else if (isSelectQuestion(question)) {
      answers.push([question.name.toString(), await select(question)]);
    } else if (isSearchQuestion(question)) {
      answers.push([
        question.name.toString(),
        await search(getSearchQuestion(question)),
      ]);
    } else if (isPathSelectQuestion(question)) {
      const pathQuestion = await getPathQuestion(question);
      const answer = await search(pathQuestion);
      if (answer === MANUAL_ENTRY_VALUE) {
        answers.push([
          question.name.toString(),
          await input({ ...question, message: 'enter path' }),
        ]);
      } else {
        answers.push([question.name.toString(), answer]);
      }
    } else {
      throw new Error(`Unsupported question type: ${JSON.stringify(question)}`);
    }
  }
  return Object.fromEntries(answers) as TInput;
}
