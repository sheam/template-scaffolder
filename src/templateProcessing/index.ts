import { createFileFromTemplate } from './createFileFromTemplate.js';
import { getTemplateFiles } from './getTemplateFiles.js';
import { log } from '../logger.js';
import { IFinalizedInputs } from '../types/index.js';

export async function processTemplates<TInput extends object>(
  processConfig: IFinalizedInputs<TInput>,
  parallel: boolean,
  dryRun: boolean
): Promise<void> {
  const start = new Date().getTime();
  log('Creating files:');

  const templateFiles = await getTemplateFiles(processConfig.template.dir);

  if (parallel) {
    const tasks = templateFiles.map(templateFile =>
      createFileFromTemplate(processConfig, templateFile, dryRun)
    );
    const taskLogs = await Promise.all(tasks);
    for (const taskLog of taskLogs) {
      taskLog.dump();
    }
  } else {
    for (const templateFile of templateFiles) {
      const taskLog = await createFileFromTemplate(
        processConfig,
        templateFile,
        dryRun
      );
      taskLog.dump();
    }
  }

  const end = new Date().getTime();
  const elapsed = (end - start) / 1000;
  log(`Created ${templateFiles.length} files in ${elapsed}s`);
}
