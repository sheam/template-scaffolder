import { log, logError, Logger } from '../logger.js';
import { getTemplateDescriptors } from './getTemplateDescriptors.js';
import { getTsCompilerOptions, loadConfigFile } from './loadConfigFile.js';
import { getSelectResponse } from '../prompts/select.js';
import {
  ICliArgs,
  ILastRunConfig,
  ISelectQuestion,
  ITemplateDescriptor,
} from '../types/index.js';
import { scaffoldingPath } from '../util.js';
import { IGetConfigFileResult } from './types.js';

export async function getConfig<TInput extends object>(
  cliValues: ICliArgs,
  lastRunConfig: ILastRunConfig | null
): Promise<ITemplateDescriptor<TInput>> {
  const parallel =
    (lastRunConfig?.args.parallel || cliValues.parallel) === true;
  const template = lastRunConfig?.args.template || cliValues.template;
  if (template) {
    log(`loading config '${template}' template specified on command line`);

    const tsCompileConfig = await getTsCompilerOptions();

    const logging = new Logger();
    const config = await loadConfigFile<TInput>(
      template,
      tsCompileConfig,
      logging.indent()
    );
    logging.dump();
    if (config) {
      return {
        config,
        dir: template,
      };
    }

    const templates = await getTemplateDescriptors<TInput>(parallel);
    const foundConfig = templates.find(x => x.config?.name === template);
    if (!foundConfig?.config) {
      logError(
        `Could not find template at ${scaffoldingPath(template)}, ` +
          `or a template in the scaffolding directory with the name ${template}.`
      );
      process.exit(1);
    }
    return {
      dir: foundConfig.dir,
      config: foundConfig.config,
    };
  }

  const templates = await getTemplateDescriptors<TInput>(parallel);

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
