import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IPrompter, IReporter } from '../src/core/ports.js';
import type { IFileResult, Question } from '../src/core/types.js';

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

/** A temp project with a copy of a scaffolding folder (default: the repo's own fixtures). */
export function tempProject(
  options: { scaffolding?: string; dirs?: string[] } = {}
): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'scaffolder-test-'));
  const from = options.scaffolding ?? path.join(REPO_ROOT, 'scaffolding');
  cpSync(from, path.join(dir, 'scaffolding'), { recursive: true });
  for (const d of options.dirs ?? [])
    mkdirSync(path.join(dir, d), { recursive: true });
  return dir;
}

/** Write files relative to a root: { 'scaffolding/x/a.txt': 'content' }. */
export function writeFiles(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), content);
  }
}

/** Every file under dir as { relativePath: content }. */
export function readTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (rel: string): void => {
    for (const entry of readdirSync(path.join(dir, rel)).sort()) {
      const r = rel ? `${rel}/${entry}` : entry;
      if (statSync(path.join(dir, r)).isDirectory()) walk(r);
      else out[r] = readFileSync(path.join(dir, r), 'utf-8');
    }
  };
  walk('');
  return out;
}

/** Answers questions from a map and records what was asked. */
export function scriptedPrompter(
  answers: Record<string, unknown>
): IPrompter & { asked: Question[] } {
  const asked: Question[] = [];
  return {
    asked,
    async ask(q) {
      asked.push(q);
      if (!(q.name in answers))
        throw new Error(`test prompter has no answer for '${q.name}'`);
      return answers[q.name];
    },
  };
}

export function memoryReporter(): IReporter & {
  lines: string[];
  warnings: string[];
  files: IFileResult[];
} {
  const lines: string[] = [];
  const warnings: string[] = [];
  const files: IFileResult[] = [];
  return {
    lines,
    warnings,
    files,
    info: m => lines.push(m),
    warn: m => warnings.push(m),
    error: m => lines.push(`ERROR ${m}`),
    debug: () => {},
    file: r => files.push(r),
  };
}
