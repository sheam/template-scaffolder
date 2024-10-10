import { getConfirmResponse } from './confirm.js';
import { watchForQuitSignal } from './helpers.js';
import { getInputResponse } from './input.js';
import { getNumberResponse } from './number.js';
import { getPathResponse } from './path.js';
import { getSearchResponse } from './search.js';
import { getSelectResponse } from './select.js';
import { log } from '../logger.js';
import {
  isConfirmQuestion,
  isInputQuestion,
  isNumberQuestion,
  isPathSelectQuestion,
  isSearchQuestion,
  isSelectQuestion,
} from '../types/helpers.js';
import { IPromptResult, Question } from '../types/index.js';

export async function prompt<TInput extends object>(
  questions: Question<TInput>[],
  promptResults: IPromptResult[] | undefined
): Promise<TInput> {
  const answers = new Array<(string | number | boolean | undefined)[]>();
  for (const question of questions) {
    if (question.when) {
      if (!question.when(Object.fromEntries(answers) as TInput)) {
        log(`skipping question ${question.message}`);
        continue;
      }
    }
    const lastAnswer = promptResults?.find(x => x.name === question.name);
    if (lastAnswer) {
      log(`${question.message} => ${lastAnswer.answer}`);
      answers.push([question.name.toString(), lastAnswer.answer || undefined]);
    } else {
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
  }
  return Object.fromEntries(answers) as TInput;
}
