import { exec } from 'child_process';
import { constants, PathLike } from 'fs';
import { access, readdir, stat } from 'node:fs/promises';
import path from 'path';
import { SCAFFOLD_FOLDER_NAME } from './constants.js';
import { log, logError } from './logger.js';

export async function existsAsync(path: PathLike): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}
export async function isDirectory(path: PathLike): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isDirectory();
  } catch (error) {
    return false;
  }
}

export async function verifyScaffoldingFolder(): Promise<void> {
  let error = false;
  if (await existsAsync(SCAFFOLD_FOLDER_NAME)) {
    const templates = await readdir(scaffoldingPath(''));
    if (templates.length <= 0) {
      logError(`No templates exist in ${path.resolve(SCAFFOLD_FOLDER_NAME)}`);
      error = true;
    }
  } else {
    logError(
      `Scaffolding folder does not exist at ${path.resolve(SCAFFOLD_FOLDER_NAME)}`
    );
    error = true;
  }

  if (error) {
    log(
      'Please create a scaffolding folder and at least one template before running again.'
    );
    process.exit(-1);
  }
}

export function scaffoldingPath(template: string, filePath = ''): string {
  return path
    .join(SCAFFOLD_FOLDER_NAME, template, filePath)
    .replace(/\//g, '/');
}

type IndexedObject = { [index: string]: unknown };
export function printValues(variables: object, indent: number = 0): void {
  if (indent === 1) {
    log(`============= RUN CONFIGURATION =============`);
  }
  function wrapValue(val: unknown): string {
    if (val === null) return 'null';
    switch (typeof val) {
      case 'undefined':
        return 'undefined';
      case 'string':
        return `'${val}'`;
      case 'object':
        return JSON.stringify(val);
      case 'function':
        return 'function';
      default:
        return `${typeof val}/${val.toString()}`;
    }
  }
  Object.keys(variables).forEach(key => {
    const val = (variables as IndexedObject)[key];
    if (val && Array.isArray(val)) {
      log(`${key}: [`, indent);
      val.forEach(item => log(wrapValue(item), indent + 1));
      log(']', indent);
    } else if (val && typeof val === 'object') {
      log(`${key}:`, indent);
      printValues(val, indent + 1);
    } else {
      log(`${key}=${wrapValue((variables as IndexedObject)[key])}`, indent);
    }
  });
  if (indent === 1) {
    log(`============= END =============`);
  }
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
