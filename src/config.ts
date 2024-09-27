import { readdir, stat } from 'node:fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { CONFIG_FILE_NAME_NO_EXT, INCLUDES_FOLDER_NAME } from './constants.js';
import { IConfigFile, IInitialInputs, ITemplateDescriptor } from './types.js';
import { log, scaffoldingPath } from './util.js';
import { loadTsConfig } from 'config-file-ts';

export async function getTemplateDescriptors(): Promise<ITemplateDescriptor[]> {
  const result: ITemplateDescriptor[] = [];
  const templateDirs = await readdir(scaffoldingPath(''));
  for (const templateDir of templateDirs) {
    if (templateDir === INCLUDES_FOLDER_NAME) continue;
    const info = await stat(scaffoldingPath(templateDir));
    if (!info.isDirectory()) continue;
    try {
      const config = await loadConfigFile(templateDir);
      result.push({
        dir: templateDir,
        name: config.name || templateDir,
        description: config.description,
      });
    } catch (_) {
      result.push({ name: templateDir, dir: templateDir });
    }
  }
  return result;
}

async function loadConfigFile(templateDir: string): Promise<IConfigFile> {
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

async function loadJsConfigFile(
  configFileScaffoldingPath: string
): Promise<IConfigFile> {
  const modulePath =
    'file://' + path.join(process.cwd(), configFileScaffoldingPath);
  log(`modulePath ${modulePath}, cwd=${process.cwd()}`, 0, true);
  const config = await import(modulePath);
  return config.default;
}
async function loadTsConfigFile(
  configFileScaffoldingPath: string
): Promise<IConfigFile> {
  log(
    `typescript config ${configFileScaffoldingPath}, cwd=${process.cwd()}`,
    0,
    true
  );
  const configPath = path.join(process.cwd(), configFileScaffoldingPath);
  const config = loadTsConfig<IConfigFile>(configPath);
  if (!config) {
    throw new Error(
      `failed to load ${configFileScaffoldingPath}, make sure the default export is a valid IConfigFile object`
    );
  }
  return config;
}

export async function getConfig(
  initialInputs: IInitialInputs
): Promise<IConfigFile> {
  log(`loading config from ${initialInputs.template.dir}`, 0, true);
  return await loadConfigFile(initialInputs.template.dir);
}
