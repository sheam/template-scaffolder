import { confirm } from '@inquirer/prompts';
import { type IConfirmQuestion } from '../types/index.js';
import { watchForQuitSignal } from './helpers.js';

export async function getConfirmResponse<TInput extends object>(
  question: IConfirmQuestion<TInput>
): Promise<boolean> {
  return await watchForQuitSignal(async () => confirm(question));
}
