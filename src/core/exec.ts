import { spawn } from 'node:child_process';
import type { CommandRunner } from './ports.js';

/** Runs a hook command through the system shell, capturing stdout and stderr together. */
export const runShellCommand: CommandRunner = (command, { cwd }) =>
  new Promise(resolve => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', chunk => (output += chunk));
    child.stderr.on('data', chunk => (output += chunk));
    child.on('error', e =>
      resolve({ exitCode: null, output: `${output}${e.message}` })
    );
    child.on('close', code =>
      resolve({ exitCode: code, output: output.trimEnd() })
    );
  });
