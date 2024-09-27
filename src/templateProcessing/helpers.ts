import { exec } from 'child_process';
import { logError } from '../util';

export function padString(str: string, char = '-', lineLen = 80): string {
  if (str.length >= lineLen) return str;
  const remaining = lineLen - str.length;
  const startPad = Math.round(remaining / 2);
  return str.padStart(str.length + startPad, char).padEnd(lineLen, char);
}

export function execCommand(
  command: string,
  handleStdOutText?: (text: string) => void,
  handleStdErrText?: (text: string) => void
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const process = exec(command);
    if (handleStdOutText) {
      process.stdout?.on('data', handleStdOutText);
    }
    if (handleStdErrText) {
      process.stderr?.on('data', handleStdErrText);
    }
    process.on('error', () => {
      logError('failed to run command');
      reject();
    });
    process.on('close', code => {
      resolve(code);
    });
  });
}
