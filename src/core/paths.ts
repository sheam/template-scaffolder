import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';

export const SCAFFOLD_FOLDER_NAME = 'scaffolding';
export const INCLUDES_FOLDER_NAME = '_includes';
export const CONFIG_FILE_BASENAME = 'scaffolding.config';
export const CONFIG_FILE_EXTENSIONS = [
  '.ts',
  '.mts',
  '.cts',
  '.js',
  '.mjs',
  '.cjs',
];
export const DEFAULT_SRC_ROOT = './src';
export const LAST_RUN_FILE_NAME = '.template-scaffolder-last-run';

/** Forward slashes on every platform; used for anything shown to users or templates. */
export function toPosix(p: string): string {
  return p.replaceAll('\\', '/');
}

export function scaffoldingDir(projectRoot: string): string {
  return path.join(projectRoot, SCAFFOLD_FOLDER_NAME);
}

export function includesDir(projectRoot: string): string {
  return path.join(scaffoldingDir(projectRoot), INCLUDES_FOLDER_NAME);
}

export async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}
