import { execCommand, log } from '../util.js';

export async function runAfterCreateCommand(command: string): Promise<void> {
  function logLines(prefix: string, text: string, indent: number): void {
    const lines = text.split(/\n/);
    lines.forEach(line => log(`${prefix}${line}`, indent));
  }

  const code = await execCommand(
    command,
    text => logLines('[stdout]:', text, 3),
    text => logLines('[stderr]:', text, 3)
  );

  log(`command exited with status: ${code}`, 2);
}
