import { select } from '@inquirer/prompts';
import { watchForQuitSignal } from './helpers.js';
import { ISelectQuestion } from '../types/index.js';

export async function getSelectResponse<TInput extends object>(
  question: ISelectQuestion<TInput>
): Promise<string> {
  return watchForQuitSignal(async () => select(question));
}
