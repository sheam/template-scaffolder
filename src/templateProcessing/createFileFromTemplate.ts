import { existsSync } from 'fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'path';
import { IFinalizedInputs } from '../types/index.js';
import { log, logError, scaffoldingPath } from '../util.js';
import { getDestinationPath } from './getDestinationPath.js';
import { getFileContents } from './getFileContents.js';
import { runAfterCreateCommand } from './runAfterCreateCommand.js';

export async function createFileFromTemplate<TInput extends object>(
  processConfig: IFinalizedInputs<TInput>,
  file: string,
  dryRun: boolean
): Promise<void> {
  if (
    !existsSync(processConfig.destination) ||
    !(await stat(processConfig.destination)).isDirectory()
  ) {
    logError(
      `Destination specified is not a directory: ${processConfig.destination}`
    );
    process.exit(-1);
  }

  const destinationDirPath = processConfig.createNameDir
    ? path.join(processConfig.destination, processConfig.instanceName)
    : processConfig.destination;

  const destinationPath = getDestinationPath(
    path.join(destinationDirPath, file),
    processConfig.variables
  );

  if (!processConfig.overwrite && existsSync(destinationPath)) {
    log(
      `WARN: file ${destinationPath} already exists, can't process template. Skipping this file`
    );
    return;
  }

  const content = await getFileContents(
    scaffoldingPath(processConfig.template.dir, file),
    processConfig.variables,
    processConfig.macros,
    processConfig.stripLines
  );

  if (dryRun) {
    log(padString(` ${destinationPath} `, '⌄'));
    log(content);
    log('⌃'.repeat(80) + '\n\n');
  } else {
    log(`creating ${destinationPath}`, 1);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, content);
  }

  if (processConfig.afterFileCreated) {
    const commands = processConfig.afterFileCreated(
      destinationPath,
      dryRun,
      processConfig.variables
    );
    if (Array.isArray(commands)) {
      for (const command of commands) {
        log(`executing ${command}`, 2);
        if (!dryRun) {
          await runAfterCreateCommand(command);
        }
      }
    }
  }
}

function padString(str: string, char = '-', lineLen = 80): string {
  if (str.length >= lineLen) return str;
  const remaining = lineLen - str.length;
  const startPad = Math.round(remaining / 2);
  return str.padStart(str.length + startPad, char).padEnd(lineLen, char);
}
