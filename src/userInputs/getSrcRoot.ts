import { DEFAULT_SRC_ROOT } from '../constants.js';
import { IConfigFile } from '../types/index.js';
import { isDirectory } from '../util.js';

export async function getSrcRoot<TInput extends object>(
  config: IConfigFile<TInput>
): Promise<string> {
  if (config.srcRoot) {
    return config.srcRoot;
  }
  if (await isDirectory(DEFAULT_SRC_ROOT)) {
    return DEFAULT_SRC_ROOT;
  }
  return process.cwd();
}
