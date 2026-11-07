/* eslint-disable no-console -- this is the console reporter */
import { styleText } from 'node:util';
import type { IReporter } from '../core/ports.js';
import type { ICommandResult, IFileResult } from '../core/types.js';

const WIDTH = 80;

function banner(text: string, char: string): string {
  const pad = Math.max(0, WIDTH - text.length);
  const left = Math.floor(pad / 2);
  return char.repeat(left) + text + char.repeat(pad - left);
}

function indent(text: string, by = '    '): string {
  return text
    .split('\n')
    .map(l => (l ? by + l : l))
    .join('\n');
}

function printCommands(commands: ICommandResult[], debug: boolean): void {
  for (const c of commands) {
    if (c.exitCode === null) {
      console.log(styleText('dim', `    would run: ${c.command}`));
      continue;
    }
    const failed = c.exitCode !== 0;
    const line = `    $ ${c.command}${failed ? ` (exit ${c.exitCode})` : ''}`;
    console.log(failed ? styleText('red', line) : styleText('dim', line));
    if (c.output && (failed || debug)) console.log(indent(c.output, '      '));
  }
}

/** Prints progress and results to the terminal. */
export function createConsoleReporter(options: { debug: boolean }): IReporter {
  return {
    info: message => console.log(message),
    warn: message => console.warn(styleText('yellow', `warning: ${message}`)),
    error: message => console.error(styleText('red', message)),
    debug: message => {
      if (options.debug) console.log(styleText('dim', message));
    },
    file(result: IFileResult) {
      switch (result.status) {
        case 'skipped':
          console.log(
            styleText('yellow', `  skipped  ${result.path}: ${result.reason}`)
          );
          break;
        case 'error':
          console.error(
            styleText('red', `  failed   ${result.path}: ${result.reason}`)
          );
          break;
        default:
          if (result.dryRun) {
            console.log(banner(` ${result.path} `, '⌄'));
            console.log(result.content ?? '');
            console.log(`${'⌃'.repeat(WIDTH)}\n`);
          } else {
            console.log(
              styleText(
                'green',
                `  ${result.status === 'created' ? 'created' : 'replaced'}`
              ) + `  ${result.path}`
            );
          }
      }
      printCommands(result.commands, options.debug);
    },
  };
}

export { printCommands };
