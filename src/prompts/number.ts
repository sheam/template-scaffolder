import { number } from '@inquirer/prompts';
import { type INumberQuestion } from '../types/index.js';
import { watchForQuitSignal } from './helpers.js';

export async function getNumberResponse<TInput extends object>(
  question: INumberQuestion<TInput>
): Promise<number | undefined> {
  return await watchForQuitSignal(async () => number(question));
}
