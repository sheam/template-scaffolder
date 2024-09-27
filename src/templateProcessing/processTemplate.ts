import { TemplateVariables } from '../types.js';

const velocityModule = await import('velocityjs');
const velocity = velocityModule.default;

export function processTemplate(
  text: string,
  variables: TemplateVariables,
  macros?: object
): string {
  return velocity.render(text, variables, macros);
}
