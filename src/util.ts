import { exec } from 'child_process';
import { existsSync } from 'fs';
import { readdir } from 'node:fs/promises';
import path from 'path';
import { SCAFFOLD_FOLDER_NAME } from './constants.js';

const IS_DEBUG = process.env.DEBUG === 'true';
export function log(str: string, indent = 0, debug = false): void {
  if (debug && !IS_DEBUG) return;
  // eslint-disable-next-line no-console
  console.log(`${'  '.repeat(indent)}${str}`);
}

export function logError(str: string): void {
  // eslint-disable-next-line no-console
  console.warn(str);
}

export async function verifyScaffoldingFolder(): Promise<void> {
  let error = false;
  if (existsSync(SCAFFOLD_FOLDER_NAME)) {
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
export function printValues(
  variables: object,
  debug = false,
  indent: number = 0
): void {
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
        return val.toString();
    }
  }
  Object.keys(variables).forEach(key => {
    const val = (variables as IndexedObject)[key];
    if (val && Array.isArray(val)) {
      log(`${key}: [`, indent, debug);
      val.forEach(item => log(wrapValue(item), indent + 1, debug));
      log(']', indent, debug);
    } else if (val && typeof val === 'object') {
      log(`${key}:`, indent, debug);
      printValues(val, debug, indent + 1);
    } else {
      log(
        `${key}=${wrapValue((variables as IndexedObject)[key])}`,
        indent,
        debug
      );
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
