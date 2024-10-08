import path from 'path';
import {
  getNearestTsConfigCompilerOptions,
  ICompileOptions,
  loadTsConfig,
} from 'config-file-ts-async';
import {
  CONFIG_FILE_NAME_NO_EXT,
  SCAFFOLD_FOLDER_NAME,
  TS_CACHE_FOLDER_NAME,
} from '../constants.js';
import { log, Logger } from '../logger.js';
import { IConfigFile } from '../types/index.js';
import { existsAsync, scaffoldingPath } from '../util.js';

export async function loadConfigFile<TInput extends object>(
  templateDir: string,
  tsCompileOptions: ICompileOptions,
  logging: Logger
): Promise<IConfigFile<TInput> | null> {
  const loaders = [
    { loader: loadTsConfigFile, extensions: ['.ts', '.mts', '.cts'] },
    { loader: loadJsConfigFile, extensions: ['.js', '.mjs', '.cjs'] },
  ];
  for (const extensionLoader of loaders) {
    for (const ext of extensionLoader.extensions) {
      const path = scaffoldingPath(templateDir, CONFIG_FILE_NAME_NO_EXT + ext);
      if (await existsAsync(path)) {
        return await extensionLoader.loader(path, tsCompileOptions, logging);
      } else {
        logging.append(`No file at ${path}`, true);
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
  _: ICompileOptions,
  logging: Logger
): Promise<IConfigFile<TInput> | null> {
  const modulePath =
    'file://' + path.join(process.cwd(), configFileScaffoldingPath);
  logging.append(`loading JS modulePath ${modulePath}`, true);
  try {
    const config = await import(modulePath);
    logging.append('  loaded', true);
    return config.default;
  } catch (e: unknown) {
    logging.appendError(`Failed to import ${modulePath}:\n ${e}`);
    return null;
  }
}

async function loadTsConfigFile<TInput extends object>(
  configFileScaffoldingPath: string,
  compilerOptions: ICompileOptions,
  logging: Logger
): Promise<IConfigFile<TInput> | null> {
  logging.append(`loading TS module ${configFileScaffoldingPath}`, true);
  const configPath = path.join(process.cwd(), configFileScaffoldingPath);
  const config = await loadTsConfig<IConfigFile<TInput>>(configPath, {
    cacheConfig: { cacheType: 'local', cacheDir: TS_CACHE_FOLDER_NAME },
    compileConfig: compilerOptions,
  });
  if (!config) {
    logging.appendError(
      `failed to load ${configFileScaffoldingPath}, make sure the default export is a valid IConfigFile object`
    );
    return null;
  }

  logging.append('  loaded', true);
  return config;
}

export async function getTsCompilerOptions(): Promise<ICompileOptions> {
  const result = await getNearestTsConfigCompilerOptions(SCAFFOLD_FOLDER_NAME);
  if (result.tsConfigPath) {
    log(`using compiler options from ${result.tsConfigPath}`);
  }
  return result.compilerOptions;
}
