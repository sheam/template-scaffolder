import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'path';
import { IFinalizedInputs } from '../types/index.js';
import { existsAsync, scaffoldingPath } from '../util.js';
import { getDestinationPath } from './getDestinationPath.js';
import { getFileContents } from './getFileContents.js';
import { runAfterCreateCommand } from './runAfterCreateCommand.js';
import { Logger } from '../logger.js';

export async function createFileFromTemplate<TInput extends object>(
  processConfig: IFinalizedInputs<TInput>,
  file: string,
  dryRun: boolean
): Promise<Logger> {
  const logging = new Logger();
  let isDir: boolean;
  try {
    const info = await stat(processConfig.destination);
    isDir = info.isDirectory();
  } catch (err) {
    isDir = false;
  }
  if (!isDir) {
    logging.appendError(
      `Destination specified is not a directory: ${processConfig.destination}`
    );
    return logging;
  }

  const destinationDirPath = processConfig.createNameDir
    ? path.join(processConfig.destination, processConfig.instanceName)
    : processConfig.destination;

  const destinationPath = getDestinationPath(
    path.join(destinationDirPath, file),
    processConfig.variables,
    logging.indent()
  );
  logging.unindent();
  if (logging.hasError()) {
    return logging;
  }

  if (!processConfig.overwrite && (await existsAsync(destinationPath))) {
    logging.appendError(
      `WARN: file ${destinationPath} already exists, can't process template. Skipping this file`
    );
    return logging;
  }

  const content = await getFileContents(
    scaffoldingPath(processConfig.template.dir, file),
    processConfig.variables,
    processConfig.macros,
    processConfig.stripLines,
    logging.indent()
  );
  logging.unindent();
  if (logging.hasError()) {
    return logging;
  }

  if (dryRun) {
    logging.append(padString(` ${destinationPath} `, '⌄'));
    logging.append(content);
    logging.append('⌃'.repeat(80) + '\n\n');
  } else {
    logging.append(`writing ${destinationPath}`);
    try {
      await mkdir(path.dirname(destinationPath), { recursive: true });
      await writeFile(destinationPath, content);
    } catch (e: unknown) {
      logging.appendError(`failed write to ${destinationPath}: ${e}`);
    }
  }

  if (processConfig.afterFileCreated) {
    const commands = processConfig.afterFileCreated(
      destinationPath,
      dryRun,
      processConfig.variables
    );
    if (Array.isArray(commands)) {
      for (const command of commands) {
        logging.append(`executing ${command}`);
        if (!dryRun) {
          await runAfterCreateCommand(command, logging);
        }
      }
    }
  }

  return logging;
}

function padString(str: string, char = '-', lineLen = 80): string {
  if (str.length >= lineLen) return str;
  const remaining = lineLen - str.length;
  const startPad = Math.round(remaining / 2);
  return str.padStart(str.length + startPad, char).padEnd(lineLen, char);
}
