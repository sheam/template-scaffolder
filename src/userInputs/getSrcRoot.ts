import { existsSync } from 'fs';
import { DEFAULT_SRC_ROOT } from '../constants.js';
import { IConfigFile } from '../types/index.js';

export function getSrcRoot<TInput extends object>(
  config: IConfigFile<TInput>
): string {
  if (config.srcRoot) {
    return config.srcRoot;
  }
  if (existsSync(DEFAULT_SRC_ROOT)) {
    return DEFAULT_SRC_ROOT;
  }
  return process.cwd();
}
