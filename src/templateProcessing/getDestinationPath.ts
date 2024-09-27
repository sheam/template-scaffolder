import { transform } from './transform.js';
import { TemplateVariables } from '../types/index.js';
import { logError } from '../util.js';

export function getDestinationPath(
  rawPath: string,
  variables: TemplateVariables
): string {
  try {
    return transform(rawPath.replaceAll('\\', '/'), variables);
  } catch (parseError: unknown) {
    logError(
      `error transforming destination file path '${rawPath}':\n${(parseError as Error).message}`
    );
    process.exit(-1);
  }
}
