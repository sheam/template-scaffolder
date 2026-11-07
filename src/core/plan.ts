import { readdir } from 'node:fs/promises';
import path from 'node:path';
import picomatch from 'picomatch';
import { errorMessage, ScaffolderError } from './errors.js';
import { CONFIG_FILE_BASENAME, exists, toPosix } from './paths.js';
import { renderString } from './render.js';
import type { TemplateVariables } from './types.js';

export interface IFilePlan {
  /** Template file relative to the template folder, forward slashes. */
  templateFile: string;
  /** Absolute path of the template file. */
  sourcePath: string;
  /** Output path relative to the project root, forward slashes. */
  path: string;
  /** Absolute output path. */
  absolutePath: string;
  action: 'create' | 'overwrite' | 'skip';
}

export interface IPlanInput {
  projectRoot: string;
  templatePath: string;
  /** Destination relative to the project root. */
  destination: string;
  name: string;
  createNameDir: boolean;
  ignore: string[];
  overwrite: boolean;
  variables: TemplateVariables;
}

const ALWAYS_IGNORED = [`${CONFIG_FILE_BASENAME}.*`];

/** Decide, for every template file, where it goes and whether it will be written. */
export async function planFiles(input: IPlanInput): Promise<IFilePlan[]> {
  const isIgnored = ignoreMatcher([...ALWAYS_IGNORED, ...input.ignore]);
  const templateFiles = (await listFiles(input.templatePath)).filter(
    f => !isIgnored(f)
  );
  const outputRoot = input.createNameDir
    ? path.posix.join(toPosix(input.destination), input.name)
    : toPosix(input.destination);

  const plans: IFilePlan[] = [];
  for (const templateFile of templateFiles) {
    let relativeOutput: string;
    try {
      relativeOutput = renderString(templateFile, input.variables);
    } catch (e) {
      throw new ScaffolderError(
        'CONFIG_INVALID',
        `Could not substitute variables in the file path '${templateFile}': ${errorMessage(e)}`,
        { cause: e }
      );
    }
    const outPath = path.posix.normalize(
      path.posix.join(outputRoot, relativeOutput)
    );
    const absolutePath = path.resolve(input.projectRoot, outPath);
    const alreadyExists = await exists(absolutePath);
    plans.push({
      templateFile,
      sourcePath: path.join(input.templatePath, templateFile),
      path: outPath,
      absolutePath,
      action: !alreadyExists
        ? 'create'
        : input.overwrite
          ? 'overwrite'
          : 'skip',
    });
  }
  return plans;
}

/** Patterns without a '/' match file names at any depth; others match the relative path. */
export function ignoreMatcher(patterns: string[]): (file: string) => boolean {
  const byName = patterns.filter(p => !p.includes('/'));
  const byPath = patterns.filter(p => p.includes('/'));
  const nameMatch = byName.length
    ? picomatch(byName, { dot: true, basename: true })
    : () => false;
  const pathMatch = byPath.length
    ? picomatch(byPath, { dot: true })
    : () => false;
  return file => nameMatch(file) || pathMatch(file);
}

/** Every file under dir, relative, forward slashes, sorted for stable output. */
async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter(e => e.isFile())
    .map(e => toPosix(path.relative(dir, path.join(e.parentPath, e.name))))
    .sort();
}
