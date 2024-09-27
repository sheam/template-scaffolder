// eslint-disable-next-line max-params
import { getFileLines } from './getFileLines.js';
import { transform } from './transform.js';
import { PatternList, TemplateVariables } from '../types/index.js';
import { logError } from '../util.js';

// eslint-disable-next-line max-params
export async function getFileContents(
  path: string,
  variables: TemplateVariables,
  macros: object,
  stripPatterns: PatternList
): Promise<string> {
  const processedFiles = new Array<string>();
  try {
    const fileLines = await getFileLines(path, stripPatterns, processedFiles);
    return transform(fileLines.join('\n'), variables, macros);
  } catch (error: unknown) {
    let message = `Error processing template file '${path}':`;
    message += `\n  message: ${(error as Error).message}`;
    message += `\n  files: ${processedFiles.join(' -> ')}`;
    logError(message);
    process.exit(-1);
  }
}
