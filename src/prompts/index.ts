import { getConfirmResponse } from './confirm.js';
import { watchForQuitSignal } from './helpers.js';
import { getInputResponse } from './input.js';
import { getNumberResponse } from './number.js';
import { getPathResponse } from './path.js';
import { getSearchResponse } from './search.js';
import { getSelectResponse } from './select.js';
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
    await watchForQuitSignal(async () => {
      if (isInputQuestion(question)) {
        answers.push([
          question.name.toString(),
          await getInputResponse(question),
        ]);
      } else if (isConfirmQuestion(question)) {
        answers.push([
          question.name.toString(),
          await getConfirmResponse(question),
        ]);
      } else if (isNumberQuestion(question)) {
        answers.push([
          question.name.toString(),
          await getNumberResponse(question),
        ]);
      } else if (isSelectQuestion(question)) {
        answers.push([
          question.name.toString(),
          await getSelectResponse(question),
        ]);
      } else if (isSearchQuestion(question)) {
        answers.push([
          question.name.toString(),
          await getSearchResponse(question),
        ]);
      } else if (isPathSelectQuestion(question)) {
        answers.push([
          question.name.toString(),
          await getPathResponse(question),
        ]);
      } else {
        throw new Error(
          `Unsupported question type: ${JSON.stringify(question)}`
        );
      }
    });
  }
  return Object.fromEntries(answers) as TInput;
}
