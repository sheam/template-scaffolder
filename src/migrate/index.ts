import { execFile } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { normalizeConfig } from '../core/config.js';
import { createConfigLoader } from '../core/configLoader.js';
import { errorMessage, ScaffolderError } from '../core/errors.js';
import {
  CONFIG_FILE_BASENAME,
  exists,
  INCLUDES_FOLDER_NAME,
  isDirectory,
  toPosix,
} from '../core/paths.js';
import { validateQuestions } from '../core/questions.js';
import tsReader from '../source/readers/typescript.js';
import { unifiedDiff } from './diff.js';
import { migrateSource, relativeImports } from './transform.js';
import type { IReporter } from '../core/ports.js';

const execFileAsync = promisify(execFile);
const SCRIPT_EXT = /\.(ts|mts|cts|js|mjs|cjs)$/;

export interface IMigrateOptions {
  projectRoot: string;
  /** Folder to migrate, relative to the project root. */
  dir: string;
  dryRun: boolean;
  force: boolean;
  reporter: IReporter;
}

export interface IMigrateResult {
  ok: boolean;
  changedFiles: string[];
  problems: string[];
}

/**
 * Files the converter looks at: every scaffolding.config.* and every script in a
 * folder starting with '_' (shared helpers), except _includes, which holds templates.
 * Template files are never touched.
 */
export async function findMigratableFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter(e => e.isFile() && SCRIPT_EXT.test(e.name))
    .map(e => toPosix(path.relative(root, path.join(e.parentPath, e.name))))
    .filter(rel => {
      const parts = rel.split('/');
      if (parts.includes('node_modules')) return false;
      if (parts[parts.length - 1].startsWith(`${CONFIG_FILE_BASENAME}.`))
        return true;
      const top = parts[0];
      return (
        parts.length > 1 && top.startsWith('_') && top !== INCLUDES_FOLDER_NAME
      );
    })
    .sort();
}

async function gitState(
  cwd: string,
  dir: string
): Promise<'clean' | 'dirty' | 'no-git'> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['status', '--porcelain', '--', dir],
      { cwd }
    );
    return stdout.trim() ? 'dirty' : 'clean';
  } catch {
    return 'no-git';
  }
}

/** Helper files a config imports from its own template folder (2.x copied them into the output). */
async function localHelpers(
  configPath: string,
  text: string
): Promise<string[]> {
  const dir = path.dirname(configPath);
  const result: string[] = [];
  for (const spec of await relativeImports(text)) {
    if (!spec.startsWith('./')) continue;
    const target = path.join(dir, spec);
    const candidates = [
      target,
      target.replace(/\.js$/, '.ts'),
      `${target}.js`,
      `${target}.ts`,
      `${target}.mjs`,
    ];
    for (const c of candidates) {
      if (path.dirname(c) === dir && (await exists(c))) {
        result.push(path.basename(c));
        break;
      }
    }
  }
  return result;
}

export async function runMigrate(
  options: IMigrateOptions
): Promise<IMigrateResult> {
  const { reporter } = options;
  const root = path.resolve(options.projectRoot, options.dir);
  if (!(await isDirectory(root))) {
    throw new ScaffolderError(
      'NO_SCAFFOLDING',
      `No folder at ${root} to migrate.`
    );
  }
  if (!options.dryRun && !options.force) {
    const state = await gitState(options.projectRoot, options.dir);
    if (state !== 'clean') {
      throw new ScaffolderError(
        'MIGRATE_REFUSED',
        state === 'dirty'
          ? `${options.dir} has uncommitted changes. Commit or stash them so the migration can be reviewed and undone, or pass --force.`
          : `${options.dir} is not in a git repository, so the migration could not be undone. Back it up and pass --force, or use --dryRun to preview.`
      );
    }
  }

  const files = await findMigratableFiles(root);
  const arities = await functionArities(root, files);
  const changedFiles: string[] = [];
  const problems: string[] = [];

  for (const rel of files) {
    const abs = path.join(root, rel);
    const display = toPosix(path.join(options.dir, rel));
    const text = await readFile(abs, 'utf-8');
    const isConfig = path.basename(rel).startsWith(`${CONFIG_FILE_BASENAME}.`);
    let result;
    try {
      result = await migrateSource(text, rel, {
        ignoreFiles: isConfig ? await localHelpers(abs, text) : [],
        arities,
      });
    } catch (e) {
      problems.push(`${display}: could not be parsed: ${errorMessage(e)}`);
      continue;
    }
    result.problems.forEach(p =>
      problems.push(`${display}:${p.line}  ${p.message}`)
    );
    if (result.text === text) continue;
    changedFiles.push(display);
    if (options.dryRun) {
      reporter.info(unifiedDiff(text, result.text, display));
      reporter.info('');
    } else {
      await writeFile(abs, result.text);
      reporter.info(`migrated ${display}`);
    }
    result.changes.forEach(c => reporter.info(`  - ${c}`));
  }

  if (!options.dryRun)
    await validate(root, options.dir, { reporter, problems });

  reporter.info('');
  reporter.info(
    changedFiles.length
      ? `${options.dryRun ? 'Would migrate' : 'Migrated'} ${changedFiles.length} of ${files.length} files.`
      : `Nothing to migrate in ${files.length} files.`
  );
  if (problems.length) {
    reporter.warn(`${problems.length} thing(s) need a look by hand:`);
    problems.forEach(p => reporter.warn(`  ${p}`));
  }
  await followUps(options.projectRoot, reporter);
  return { ok: problems.length === 0, changedFiles, problems };
}

/**
 * Parameter counts of every top-level function in the files being migrated, so that
 * `afterFileCreated: formatFileCommand` is wrapped with the right number of arguments.
 * Names declared twice with different counts are left out.
 */
async function functionArities(
  root: string,
  files: string[]
): Promise<Record<string, number>> {
  const seen = new Map<string, number | null>();
  for (const rel of files) {
    try {
      const file = await tsReader.read({
        path: rel,
        text: await readFile(path.join(root, rel), 'utf-8'),
      });
      for (const f of file.functions) {
        const prev = seen.get(f.name);
        seen.set(
          f.name,
          prev === undefined || prev === f.params.length
            ? f.params.length
            : null
        );
      }
    } catch {
      // unparsable files are reported by the migration itself
    }
  }
  return Object.fromEntries(
    [...seen].filter((e): e is [string, number] => e[1] !== null)
  );
}

/** Load every migrated config the way a run would, and report what v3 still objects to. */
async function validate(
  root: string,
  dir: string,
  out: { reporter: IReporter; problems: string[] }
): Promise<void> {
  const loader = createConfigLoader();
  for (const rel of (await findMigratableFiles(root)).filter(f =>
    path.basename(f).startsWith(`${CONFIG_FILE_BASENAME}.`)
  )) {
    const display = toPosix(path.join(dir, rel));
    try {
      const { config, warnings } = normalizeConfig(
        await loader.load(path.join(root, rel)),
        path.dirname(rel)
      );
      warnings.forEach(w => out.problems.push(`${display}  ${w}`));
      const promptsValue = await config.prompts({} as never).catch(() => null);
      if (Array.isArray(promptsValue)) {
        validateQuestions(promptsValue, config.name).warnings.forEach(w =>
          out.problems.push(`${display}  ${w}`)
        );
      }
    } catch (e) {
      const details =
        e instanceof ScaffolderError && e.details.length
          ? ` ${e.details.join(' ')}`
          : '';
      out.problems.push(`${display}  ${errorMessage(e)}${details}`);
    }
  }
}

async function followUps(
  projectRoot: string,
  reporter: IReporter
): Promise<void> {
  const notes: string[] = [];
  if (await exists(path.join(projectRoot, '.template-scaffolder-ts-cache'))) {
    notes.push(
      'Delete the .template-scaffolder-ts-cache folder; v3 does not use it.'
    );
  }
  const gitignore = path.join(projectRoot, '.gitignore');
  if (
    (await exists(gitignore)) &&
    (await readFile(gitignore, 'utf-8')).includes(
      '.template-scaffolder-ts-cache'
    )
  ) {
    notes.push('Remove .template-scaffolder-ts-cache from .gitignore.');
  }
  notes.push(
    'A 2.x .template-scaffolder-last-run file is still read by --rerun; nothing to do.'
  );
  reporter.info('');
  notes.forEach(n => reporter.info(`note: ${n}`));
}
