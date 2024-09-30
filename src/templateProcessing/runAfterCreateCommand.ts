import { Logger } from '../logger.js';
import { execCommand } from '../util.js';

export async function runAfterCreateCommand(
  command: string,
  logging: Logger
): Promise<void> {
  logging.indent();
  const code = await execCommand(
    command,
    text => logging.append(text),
    text => logging.appendError(text)
  );
  logging.unindent();

  logging.append(`command exited with status: ${code}`);
}
