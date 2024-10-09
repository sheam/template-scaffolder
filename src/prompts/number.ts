import { number } from '@inquirer/prompts';
import { watchForQuitSignal } from './helpers.js';
import { INumberQuestion } from '../types/index.js';

export async function getNumberResponse<TInput extends object>(
  question: INumberQuestion<TInput>
): Promise<number | undefined> {
  return await watchForQuitSignal(async () => number(question));
}
