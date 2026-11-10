import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { mapConcurrent } from './concurrency.js';
import { type INormalizedConfig, normalizeConfig } from './config.js';
import { errorMessage, ScaffolderError } from './errors.js';
import {
  CONFIG_FILE_BASENAME,
  CONFIG_FILE_EXTENSIONS,
  exists,
  isDirectory,
  SCAFFOLD_FOLDER_NAME,
  scaffoldingDir,
} from './paths.js';
import type { IConfigLoader } from './configLoader.js';
import type { IReporter } from './ports.js';

export interface ITemplate {
  /** Folder name under scaffolding/. */
  dir: string;
  /** Absolute path of the template folder. */
  path: string;
  config: INormalizedConfig;
}

interface ITemplateDeps {
  projectRoot: string;
  loader: IConfigLoader;
  reporter: IReporter;
}

export async function verifyScaffoldingFolder(
  projectRoot: string
): Promise<void> {
  const dir = scaffoldingDir(projectRoot);
  if (!(await isDirectory(dir))) {
    throw new ScaffolderError(
      'NO_SCAFFOLDING',
      `No '${SCAFFOLD_FOLDER_NAME}' folder at ${dir}. Create it with at least one template folder.`
    );
  }
  if ((await listTemplateDirs(projectRoot)).length === 0) {
    throw new ScaffolderError(
      'NO_SCAFFOLDING',
      `No templates in ${dir}. Add a folder containing a ${CONFIG_FILE_BASENAME}.(ts|js) file.`
    );
  }
}

/** Template folders: every directory under scaffolding/ not starting with '_' or '.'. */
export async function listTemplateDirs(projectRoot: string): Promise<string[]> {
  const entries = await readdir(scaffoldingDir(projectRoot), {
    withFileTypes: true,
  });
  return entries
    .filter(
      e => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.')
    )
    .map(e => e.name)
    .sort();
}

export async function findConfigFile(
  templatePath: string
): Promise<string | null> {
  for (const ext of CONFIG_FILE_EXTENSIONS) {
    const candidate = path.join(templatePath, CONFIG_FILE_BASENAME + ext);
    if (await exists(candidate)) return candidate;
  }
  return null;
}

export async function loadTemplate(
  dir: string,
  deps: ITemplateDeps
): Promise<ITemplate> {
  const templatePath = path.join(scaffoldingDir(deps.projectRoot), dir);
  if (!(await isDirectory(templatePath))) {
    throw new ScaffolderError(
      'TEMPLATE_NOT_FOUND',
      `No template folder at ${templatePath}.`
    );
  }
  const configFile = await findConfigFile(templatePath);
  if (!configFile) {
    throw new ScaffolderError(
      'CONFIG_NOT_FOUND',
      `Template '${dir}' has no ${CONFIG_FILE_BASENAME}.{${CONFIG_FILE_EXTENSIONS.map(e => e.slice(1)).join(',')}} file.`
    );
  }
  deps.reporter.debug(`loading ${configFile}`);
  const raw = await deps.loader.load(configFile);
  const { config, warnings } = normalizeConfig(raw, dir);
  warnings.forEach(w => deps.reporter.warn(`${dir}: ${w}`));
  return { dir, path: templatePath, config };
}

/**
 * Load every template. Broken templates are reported as warnings and left out,
 * so one bad config does not block the others.
 */
export async function discoverTemplates(
  deps: ITemplateDeps & { parallel: boolean }
): Promise<ITemplate[]> {
  const dirs = await listTemplateDirs(deps.projectRoot);
  const results = await mapConcurrent(
    dirs,
    async dir => {
      try {
        return await loadTemplate(dir, deps);
      } catch (e) {
        deps.reporter.warn(`skipping template '${dir}': ${describeError(e)}`);
        return null;
      }
    },
    { parallel: deps.parallel }
  );
  return results.filter((t): t is ITemplate => t !== null);
}

/** Find a template by folder name, falling back to the `name` in its config. */
export async function findTemplate(
  nameOrDir: string,
  deps: ITemplateDeps & { parallel: boolean }
): Promise<ITemplate> {
  const dirs = await listTemplateDirs(deps.projectRoot);
  if (dirs.includes(nameOrDir)) return loadTemplate(nameOrDir, deps);
  const all = await discoverTemplates(deps);
  const match = all.find(t => t.config.name === nameOrDir);
  if (!match) {
    throw new ScaffolderError(
      'TEMPLATE_NOT_FOUND',
      `No template folder or template named '${nameOrDir}'. Available: ${all.map(t => t.dir).join(', ') || 'none'}.`
    );
  }
  return match;
}

export function templateTitle(t: ITemplate): string {
  const title = t.config.name || t.dir;
  return t.config.description
    ? `${title} - ${t.config.description.substring(0, 60)}`
    : title;
}

function describeError(e: unknown): string {
  if (e instanceof ScaffolderError && e.details.length) {
    return `${e.message} ${e.details.join(' ')}`;
  }
  return errorMessage(e);
}
