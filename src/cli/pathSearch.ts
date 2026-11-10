import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { toPosix } from '../core/paths.js';
import type { IPathInfo, IPathQuestion } from '../core/types.js';

/**
 * Filter path entries by space-separated search words.
 * One word: substring match. Several words: each must prefix a later path segment
 * or camelCase word, in order (so 'al qu' finds 'alerts/QueryAlert.tsx').
 */
export function searchPathEntries(
  input: string | undefined,
  entries: IPathInfo[]
): IPathInfo[] {
  const targets =
    input?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  if (targets.length === 0) return entries;
  if (targets.length === 1) {
    return entries.filter(e => e.path.toLowerCase().includes(targets[0]));
  }
  return entries.filter(e => {
    const parts = e.path.split(/\/|(?=[A-Z])/).map(s => s.toLowerCase());
    let last = -1;
    for (const target of targets) {
      const found = parts.findIndex(
        (part, i) => i > last && part.startsWith(target)
      );
      if (found < 0) return false;
      last = found;
    }
    return true;
  });
}

/** List files and/or directories under the question's rootPath. */
export async function listPathEntries(q: IPathQuestion): Promise<IPathInfo[]> {
  const result: IPathInfo[] = [];
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (typeof q.depthLimit === 'number' && depth >= q.depthLimit) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const info: IPathInfo = {
        path: toPosix(path.join(dir, entry.name)),
        name: entry.name,
        isDir: entry.isDirectory(),
      };
      if (q.excludePath?.(info)) continue;
      if (info.isDir) {
        if (q.itemType !== 'file') result.push(info);
        await walk(path.join(dir, entry.name), depth + 1);
      } else if (q.itemType !== 'directory') {
        result.push(info);
      }
    }
  };
  await walk(q.rootPath || '.', 0);
  return result;
}
