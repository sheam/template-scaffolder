import { readdir, stat } from 'node:fs/promises';
import path from 'path';
import { CONFIG_FILE_NAME_NO_EXT } from '../constants.js';
import { scaffoldingPath } from '../util.js';

export async function getTemplateFiles(template: string): Promise<string[]> {
  async function readDirRecursive(dir: string): Promise<string[]> {
    const files = new Array<string>();
    const dirs = await readdir(dir);
    for (const file of dirs) {
      const fullPath = path.join(dir, file);
      const fstat = await stat(fullPath);
      if (fstat.isDirectory()) {
        const subFiles = await readDirRecursive(fullPath);
        subFiles.forEach(x => files.push(x));
      } else {
        files.push(fullPath);
      }
    }
    return files;
  }

  const templateDir = scaffoldingPath(template);
  const dirs = await readDirRecursive(scaffoldingPath(template));
  return dirs
    .map(p => p.substring(templateDir.length + 1))
    .filter(p => !p.startsWith(CONFIG_FILE_NAME_NO_EXT));
}
