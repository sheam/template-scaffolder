import { type Logger } from '../logger.js';
import { type TemplateVariables } from '../types/index.js';
import { transform } from './transform.js';

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
