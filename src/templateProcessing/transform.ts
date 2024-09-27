import { TemplateVariables } from '../types/index.js';

const velocityModule = await import('velocityjs');
const velocity = velocityModule.default;

export function transform(
  text: string,
  variables: TemplateVariables,
  macros?: object
): string {
  return velocity.render(text, variables, macros);
}
