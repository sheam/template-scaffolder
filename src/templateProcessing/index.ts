import { createFileFromTemplate } from './createFileFromTemplate.js';
import { getTemplateFiles } from './getTemplateFiles.js';
import { IFinalizedInputs } from '../types/index.js';

export async function processTemplates(
  processConfig: IFinalizedInputs,
  dryRun?: boolean
): Promise<void> {
  const templateFiles = await getTemplateFiles(processConfig.template.dir);

  for (const templateFile of templateFiles) {
    await createFileFromTemplate(processConfig, templateFile, dryRun || false);
  }
}