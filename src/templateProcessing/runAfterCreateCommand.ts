import { Logger } from '../logger.js';
import { execCommand } from '../util.js';

export async function runAfterCreateCommand(
  command: string,
  logging: Logger
): Promise<void> {
  const code = await execCommand(
    command,
    text => logging.append(text, 3),
    text => logging.appendError(text, 3)
  );

  logging.append(`command exited with status: ${code}`, 2);
}
