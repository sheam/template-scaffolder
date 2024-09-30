import { transform } from './transform.js';
import { Logger } from '../logger.js';
import { TemplateVariables } from '../types/index.js';

export function getDestinationPath(
  rawPath: string,
  variables: TemplateVariables,
  logging: Logger
): string {
  try {
    return transform(rawPath.replaceAll('\\', '/'), variables);
  } catch (parseError: unknown) {
    logging.appendError(
      `error transforming destination file path '${rawPath}':\n${(parseError as Error).message}`
    );
    return '';
  }
}
