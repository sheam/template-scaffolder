import { createFileFromTemplate } from './createFileFromTemplate.js';
import { getTemplateFiles } from './getTemplateFiles.js';
import { IFinalizedInputs } from '../types/index.js';

export async function processTemplates<TInput extends object>(
  processConfig: IFinalizedInputs<TInput>,
  dryRun?: boolean
): Promise<number> {
  const templateFiles = await getTemplateFiles(processConfig.template.dir);

  for (const templateFile of templateFiles) {
    await createFileFromTemplate(processConfig, templateFile, dryRun || false);
  }

  return templateFiles.length;
}
