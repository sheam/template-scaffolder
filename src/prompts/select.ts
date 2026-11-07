import { select } from '@inquirer/prompts';
import { type ISelectQuestion } from '../types/index.js';
import { watchForQuitSignal } from './helpers.js';

export async function getSelectResponse<TInput extends object>(
  question: ISelectQuestion<TInput>
): Promise<string> {
  return watchForQuitSignal(async () => select(question));
}
