import { readdir, stat } from 'node:fs/promises';
import { IGetConfigFileResult } from './types.js';
import { INCLUDES_FOLDER_NAME } from '../constants.js';
import { log, Logger } from '../logger.js';
import { scaffoldingPath } from '../util.js';
import { loadConfigFile } from './loadConfigFile.js';

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
      configFilePromises.push(getConfigFileFromTemplateDir(templateDir));
    }
    const results = await Promise.all(configFilePromises);
    results.forEach(r => r.logging.dump());
    return results.filter(x => x.config !== null);
  } else {
    const configFiles = new Array<IGetConfigFileResult<TInput>>();
    for (const templateDir of templateDirs) {
      const result = await getConfigFileFromTemplateDir(templateDir);
      result.logging.dump();
      if (result.config) {
        configFiles.push(result);
      }
    }
    return configFiles;
  }
}

async function getConfigFileFromTemplateDir<TInput extends object>(
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
