import { readdir, stat } from 'node:fs/promises';
import * as path from 'path';
import { SearchQuestionImplementation } from './search.js';
import { MANUAL_ENTRY_VALUE } from './types.js';
import { IChoice, IPathInfo, IPathSelectQuestion } from '../types/index.js';

export async function getPathQuestion<TInput extends object>(
  q: IPathSelectQuestion<TInput>
): Promise<SearchQuestionImplementation<TInput>> {
  const pathEntries = await getDir(q.rootPath || process.cwd(), 0, q);
  return {
    type: 'search',
    name: q.name,
    message: q.message,
    default: q.default,
    source: input =>
      searchPathEntryChoices(input, pathEntries, q.allowManualInput === true),
  };
}

async function searchPathEntryChoices(
  input: string | undefined,
  fileEntries: IPathInfo[],
  allowManual: boolean
): Promise<IChoice[]> {
  const entries = searchPathEntries(input, fileEntries).map(x => ({
    name: x.path,
    value: x.path,
  }));
  if (allowManual) {
    entries.push({ name: 'manual path entry', value: MANUAL_ENTRY_VALUE });
  }
  return entries;
}

export function searchPathEntries(
  input: string | undefined,
  fileEntries: IPathInfo[]
): IPathInfo[] {
  if (!input?.trim()) {
    return fileEntries;
  }
  const targets = input.trim().toLowerCase().split(/\s+/);
  if (targets.length === 0) {
    return fileEntries;
  }
  if (targets.length === 1) {
    return fileEntries.filter(info =>
      info.path.toLowerCase().includes(targets[0])
    );
  }

  return fileEntries.filter(info => {
    const parts = info.path.split(/\/|(?=[A-Z])/).map(s => s.toLowerCase());
    let lastFoundIndex = -1;
    for (const target of targets) {
      const foundIndex = parts.findIndex(
        (part, i) => i > lastFoundIndex && part.startsWith(target)
      );
      if (foundIndex >= 0) {
        lastFoundIndex = foundIndex;
      } else {
        return false;
      }
    }
    return true;
  });
}

async function getDir<TInput extends object>(
  rootPath: string,
  currentDepth: number,
  q: IPathSelectQuestion<TInput>
): Promise<IPathInfo[]> {
  const result = new Array<IPathInfo>();
  // log(`processing ${rootPath} (depth=${currentDepth})`);
  if (typeof q.depthLimit === 'number' && currentDepth >= q.depthLimit) {
    return result;
  }

  const entryPaths = await readdir(rootPath);
  for (const entry of entryPaths) {
    const entryPath = path.join(rootPath, entry);
    const entryStat = await stat(entryPath);
    const entryInfo: IPathInfo = {
      path: entryPath.replaceAll('\\', '/'),
      name: entry,
      isDir: entryStat.isDirectory(),
    };
    if (q.excludePath && q.excludePath(entryInfo)) {
      continue;
    }
    if (entryInfo.isDir) {
      if (q.itemType !== 'file') {
        result.push(entryInfo);
      }
      const dirResults = await getDir(entryPath, currentDepth + 1, q);
      result.push(...dirResults);
    } else if (q.itemType !== 'directory') {
      result.push(entryInfo);
    }
  }
  return result;
}
