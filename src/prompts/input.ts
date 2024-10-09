import { input } from '@inquirer/prompts';
import { watchForQuitSignal } from './helpers.js';
import { IInputQuestion } from '../types/index.js';

export async function getInputResponse<TInput extends object>(
  question: IInputQuestion<TInput>
): Promise<string> {
  return await watchForQuitSignal(async () => input(question));
}
