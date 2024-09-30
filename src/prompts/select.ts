import { select } from '@inquirer/prompts';
import { ISelectQuestion } from '../types/index.js';

export async function getSelectResponse<TInput extends object>(
  question: ISelectQuestion<TInput>
): Promise<string> {
  return select(question);
}
