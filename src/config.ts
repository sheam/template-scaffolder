import { existsSync } from 'fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'path';
import { loadTsConfig } from 'config-file-ts';
import {
  CONFIG_FILE_NAME_NO_EXT,
  INCLUDES_FOLDER_NAME,
  TS_CACHE_FOLDER_NAME,
} from './constants.js';
import {
  IConfigFile,
  IInitialInputs,
  ITemplateDescriptor,
} from './types/index.js';
import { log, scaffoldingPath } from './util.js';

export async function getTemplateDescriptors(
  parallel: boolean | undefined
): Promise<ITemplateDescriptor[]> {
  const templateDirs = await readdir(scaffoldingPath(''));

  const getTemplateDescriptor = async (
    templateDir: string
  ): Promise<ITemplateDescriptor | null> => {
    if (templateDir === INCLUDES_FOLDER_NAME || templateDir.startsWith('_')) {
      return null;
    }
    const info = await stat(scaffoldingPath(templateDir));
    if (!info.isDirectory()) return null;

    try {
      const config = await loadConfigFile(templateDir);
      return {
        dir: templateDir,
        name: config.name || templateDir,
        description: config.description,
      };
    } catch (_) {
      return { name: templateDir, dir: templateDir };
    }
  };

  if (parallel) {
    log('loading template configurations in parallel');
    const templateDescriptorPromises = new Array<
      Promise<ITemplateDescriptor | null>
    >();
    for (const templateDir of templateDirs) {
      templateDescriptorPromises.push(getTemplateDescriptor(templateDir));
    }
    const result = await Promise.all(templateDescriptorPromises);
    return result.filter(x => x !== null);
  } else {
    const templateDescriptors = new Array<ITemplateDescriptor>();
    for (const templateDir of templateDirs) {
      const descriptor = await getTemplateDescriptor(templateDir);
      if (descriptor) {
        templateDescriptors.push(descriptor);
      }
    }
    return templateDescriptors;
  }
}

async function loadConfigFile<TInput extends object>(
  templateDir: string
): Promise<IConfigFile<TInput>> {
  const loaders = [
    { loader: loadJsConfigFile, extensions: ['.js', '.mjs'] },
    { loader: loadTsConfigFile, extensions: ['.ts', '.mts'] },
  ];
  for (const extensionLoader of loaders) {
    for (const ext of extensionLoader.extensions) {
      const path = scaffoldingPath(templateDir, CONFIG_FILE_NAME_NO_EXT + ext);
      if (existsSync(path)) {
        return await extensionLoader.loader(path);
      }
    }
  }
  throw new Error(
    `Unable to find ${CONFIG_FILE_NAME_NO_EXT}.[js,mjs,ts,mts] in ${templateDir}`
  );
}

async function loadJsConfigFile<TInput extends object>(
  configFileScaffoldingPath: string
): Promise<IConfigFile<TInput>> {
  const modulePath =
    'file://' + path.join(process.cwd(), configFileScaffoldingPath);
  log(`modulePath ${modulePath}, cwd=${process.cwd()}`, 0, true);
  const config = await import(modulePath);
  return config.default;
}

async function loadTsConfigFile<TInput extends object>(
  configFileScaffoldingPath: string
): Promise<IConfigFile<TInput>> {
  log(
    `typescript config ${configFileScaffoldingPath}, cwd=${process.cwd()}`,
    0,
    true
  );
  const configPath = path.join(process.cwd(), configFileScaffoldingPath);
  const cachePath = path.join(
    process.cwd(),
    TS_CACHE_FOLDER_NAME,
    configFileScaffoldingPath
  );
  const config = loadTsConfig<IConfigFile<TInput>>(configPath, cachePath, true);
  if (!config) {
    throw new Error(
      `failed to load ${configFileScaffoldingPath}, make sure the default export is a valid IConfigFile object`
    );
  }
  return config;
}

export async function getConfig<TInput extends object>(
  initialInputs: IInitialInputs
): Promise<IConfigFile<TInput>> {
  log(`loading config from ${initialInputs.template.dir}`, 0, true);
  return await loadConfigFile(initialInputs.template.dir);
}
