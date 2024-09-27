import { existsSync } from 'fs';
import { readdir } from 'node:fs/promises';
import * as path from 'path';
import { SCAFFOLD_FOLDER_NAME } from './constants';

export function log(str: string, indent = 0, debug = false): void {
  if (debug && !process.env.DEBUG) return;
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
  function wrapValue(val: unknown): string {
    if (val === null) return 'null';
    switch (typeof val) {
      case 'undefined':
        return 'undefined';
      case 'string':
        return `'${val}'`;
      case 'object':
        return `[${val.toString()}]`;
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
}
