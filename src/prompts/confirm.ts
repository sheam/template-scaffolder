import { confirm } from '@inquirer/prompts';
import { watchForQuitSignal } from './helpers.js';
import { IConfirmQuestion } from '../types/index.js';

export async function getConfirmResponse<TInput extends object>(
  question: IConfirmQuestion<TInput>
): Promise<boolean> {
  return await watchForQuitSignal(async () => confirm(question));
}
