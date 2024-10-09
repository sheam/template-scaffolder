import { log } from '../logger.js';

export async function watchForQuitSignal<TAnswer>(
  promptCallback: () => Promise<TAnswer>
): Promise<TAnswer> {
  try {
    return await promptCallback();
  } catch (e: unknown) {
    if (
      e !== null &&
      typeof e === 'object' &&
      'name' in e &&
      e.name === 'ExitPromptError'
    ) {
      log('Quitting');
      process.exit(1);
    }
    throw e;
  }
}
