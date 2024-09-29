import { createFileFromTemplate } from './createFileFromTemplate.js';
import { getTemplateFiles } from './getTemplateFiles.js';
import { IFinalizedInputs } from '../types/index.js';

export async function processTemplates<TInput extends object>(
  processConfig: IFinalizedInputs<TInput>,
  parallel: boolean,
  dryRun: boolean
): Promise<number> {
  const templateFiles = await getTemplateFiles(processConfig.template.dir);

  if (parallel) {
    const tasks = templateFiles.map(templateFile =>
      createFileFromTemplate(processConfig, templateFile, dryRun)
    );
    await Promise.all(tasks);
  } else {
    for (const templateFile of templateFiles) {
      await createFileFromTemplate(processConfig, templateFile, dryRun);
    }
  }

  return templateFiles.length;
}
