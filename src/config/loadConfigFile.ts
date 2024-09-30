import { existsSync } from 'fs';
import path from 'path';
import { loadTsConfig } from 'config-file-ts';
import { CONFIG_FILE_NAME_NO_EXT, TS_CACHE_FOLDER_NAME } from '../constants.js';
import { Logger } from '../logger.js';
import { IConfigFile } from '../types/index.js';
import { scaffoldingPath } from '../util.js';

export async function loadConfigFile<TInput extends object>(
  templateDir: string,
  logging: Logger
): Promise<IConfigFile<TInput> | null> {
  const loaders = [
    { loader: loadJsConfigFile, extensions: ['.js', '.mjs'] },
    { loader: loadTsConfigFile, extensions: ['.ts', '.mts'] },
  ];
  for (const extensionLoader of loaders) {
    for (const ext of extensionLoader.extensions) {
      const path = scaffoldingPath(templateDir, CONFIG_FILE_NAME_NO_EXT + ext);
      if (existsSync(path)) {
        return await extensionLoader.loader(path, logging);
      }
    }
  }
  logging.appendError(
    `Unable to find ${CONFIG_FILE_NAME_NO_EXT}.[js,mjs,ts,mts] in ${templateDir}`
  );
  return null;
}

async function loadJsConfigFile<TInput extends object>(
  configFileScaffoldingPath: string,
  logging: Logger
): Promise<IConfigFile<TInput> | null> {
  const modulePath =
    'file://' + path.join(process.cwd(), configFileScaffoldingPath);
  logging.append(`modulePath ${modulePath}, cwd=${process.cwd()}`, true);
  try {
    const config = await import(modulePath);
    return config.default;
  } catch (e: unknown) {
    logging.appendError(`Failed to import ${modulePath}:\n ${e}`);
    return null;
  }
}

async function loadTsConfigFile<TInput extends object>(
  configFileScaffoldingPath: string,
  logging: Logger
): Promise<IConfigFile<TInput> | null> {
  logging.append(
    `typescript config ${configFileScaffoldingPath}, cwd=${process.cwd()}`,
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
    logging.appendError(
      `failed to load ${configFileScaffoldingPath}, make sure the default export is a valid IConfigFile object`
    );
    return null;
  }
  return config;
}
