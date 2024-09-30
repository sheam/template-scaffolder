import { existsSync } from 'fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'path';
import { loadTsConfig } from 'config-file-ts';
import {
  CONFIG_FILE_NAME_NO_EXT,
  INCLUDES_FOLDER_NAME,
  TS_CACHE_FOLDER_NAME,
} from './constants.js';
import { log, logError, Logger } from './logger.js';
import { getSelectResponse } from './prompts/select.js';
import {
  ICliArgs,
  IConfigFile,
  ISelectQuestion,
  ITemplateDescriptor,
} from './types/index.js';
import { scaffoldingPath } from './util.js';

export interface IGetConfigFileResult<TInput extends object> {
  logging: Logger;
  dir: string;
  config: IConfigFile<TInput> | null;
}

async function getConfigFile<TInput extends object>(
  templateDir: string
): Promise<IGetConfigFileResult<TInput>> {
  const logging = new Logger();

  if (templateDir === INCLUDES_FOLDER_NAME || templateDir.startsWith('_')) {
    logging.append(`ignoring ${templateDir}`, true);
    return { logging: logging.unindent(), dir: templateDir, config: null };
  }
  const info = await stat(scaffoldingPath(templateDir));
  if (!info.isDirectory()) {
    logging.append(`${scaffoldingPath(templateDir)} is not a directory`, true);
    return { logging: logging.unindent(), dir: templateDir, config: null };
  }

  try {
    const config = await loadConfigFile(templateDir, logging.indent());
    if (!config) {
      return { logging: logging.unindent(), dir: templateDir, config: null };
    }
    return {
      logging: logging.unindent(),
      dir: templateDir,
      config,
    };
  } catch (e: unknown) {
    logging.unindent();
    logging.appendError(`Error loading: ${e}`);
    return {
      logging,
      dir: templateDir,
      config: null,
    };
  }
}

export async function getTemplateDescriptors<TInput extends object>(
  parallel: boolean | undefined
): Promise<IGetConfigFileResult<TInput>[]> {
  const templateDirs = await readdir(scaffoldingPath(''));

  if (parallel) {
    log('loading template configurations in parallel');
    const configFilePromises = new Array<
      Promise<IGetConfigFileResult<TInput>>
    >();
    for (const templateDir of templateDirs) {
      configFilePromises.push(getConfigFile(templateDir));
    }
    const results = await Promise.all(configFilePromises);
    results.forEach(r => r.logging.dump());
    return results.filter(x => x.config !== null);
  } else {
    const configFiles = new Array<IGetConfigFileResult<TInput>>();
    for (const templateDir of templateDirs) {
      const result = await getConfigFile(templateDir);
      result.logging.dump();
      if (result.config) {
        configFiles.push(result);
      }
    }
    return configFiles;
  }
}

async function loadConfigFile<TInput extends object>(
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

export async function getConfig<TInput extends object>(
  cliValues: ICliArgs
): Promise<ITemplateDescriptor<TInput>> {
  if (cliValues.template) {
    log(
      `loading config ${cliValues.template} template specified on command line`
    );

    const logging = new Logger();
    const config = await loadConfigFile<TInput>(
      scaffoldingPath(cliValues.template),
      logging.indent()
    );
    logging.dump();
    if (config) {
      return {
        config,
        dir: cliValues.template,
      };
    }

    const templates = await getTemplateDescriptors<TInput>(
      cliValues.parallel === true
    );
    const foundConfig = templates.find(
      x => x.config?.name === cliValues.template
    );
    if (!foundConfig?.config) {
      logError(
        `Could not find template at ${scaffoldingPath(cliValues.template)}, ` +
          `or a template in the scaffolding directory with the name ${cliValues.template}.`
      );
      process.exit(1);
    }
    return {
      dir: foundConfig.dir,
      config: foundConfig.config,
    };
  }

  const templates = await getTemplateDescriptors<TInput>(cliValues.parallel);

  const getTitle = (td: IGetConfigFileResult<TInput>): string => {
    if (!td.config) throw new Error('config must be present');
    const s = td.config.name || td.dir;
    if (!td.config.description) return s;
    return `${s} - ${td.config.description.substring(0, 50)}`;
  };

  const templateQuestion: ISelectQuestion<TInput> = {
    name: 'template' as keyof TInput,
    choices: templates.map(td => ({
      value: td.dir,
      name: getTitle(td),
    })),
    message: 'Select the template: ',
    type: 'select',
    required: true,
  };
  const selectedTemplate = await getSelectResponse(templateQuestion);
  const foundConfig = templates.find(x => x.dir === selectedTemplate);
  if (!foundConfig?.config) {
    logError(`Could not find the template you selected: ${selectedTemplate}`);
    process.exit(1);
  }
  return {
    dir: foundConfig.dir,
    config: foundConfig.config,
  };
}
