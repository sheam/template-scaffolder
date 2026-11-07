import { input } from '@inquirer/prompts';
import { type IInputQuestion } from '../types/index.js';
import { watchForQuitSignal } from './helpers.js';

export async function getInputResponse<TInput extends object>(
  question: IInputQuestion<TInput>
): Promise<string> {
  return await watchForQuitSignal(async () => input(question));
}
