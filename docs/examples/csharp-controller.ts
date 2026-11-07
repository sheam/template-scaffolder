/**
 * Example: list the actions of an ASP.NET controller, e.g. to generate a typed client
 * or tests for each endpoint.
 *
 *   variables: async ({ answers }) => ({ ACTIONS: await getControllerActions(answers.CONTROLLER) })
 */
import { csharpTypes, readSource } from 'template-scaffolder/source';

export interface IAction {
  name: string;
  verb: string;
  /** Route template, combined with the controller's [Route]. */
  route: string;
  /** The response body type, unwrapped from Task<ActionResult<...>>. */
  resultType: string;
  params: {
    name: string;
    type: string;
    fromBody: boolean;
    optional: boolean;
  }[];
}

const VERBS = ['HttpGet', 'HttpPost', 'HttpPut', 'HttpPatch', 'HttpDelete'];
const SIMPLE_TYPES = new Set([
  'int',
  'long',
  'short',
  'byte',
  'bool',
  'string',
  'decimal',
  'double',
  'float',
  'Guid',
  'DateTime',
  'DateTimeOffset',
]);

/** `Route("api/tanks")` -> `api/tanks` */
function attributeArgument(attribute: string): string {
  return /\("([^"]*)"/.exec(attribute)?.[1] ?? '';
}

export async function getControllerActions(file: string): Promise<IAction[]> {
  const source = await readSource(file);
  const controller = source.findTypes(
    t =>
      t.kind === 'class' &&
      t.attributes.some(a => a.startsWith('ApiController'))
  )[0];
  if (!controller) throw new Error(`no [ApiController] class in ${file}`);
  const baseRoute = attributeArgument(
    controller.attributes.find(a => a.startsWith('Route')) ?? ''
  );

  return controller.methods
    .filter(m => m.access === 'public')
    .flatMap(m => {
      const verbAttribute = m.attributes.find(a =>
        VERBS.some(v => a.startsWith(v))
      );
      if (!verbAttribute) return [];
      const route = attributeArgument(verbAttribute);
      return [
        {
          name: m.name,
          verb: verbAttribute
            .replace(/^Http/, '')
            .replace(/\(.*$/, '')
            .toUpperCase(),
          route: [baseRoute, route].filter(Boolean).join('/'),
          resultType: csharpTypes.unwrapActionResult(
            csharpTypes.unwrapTask(m.returnType)
          ),
          params: m.params.map(p => {
            const type = csharpTypes.unwrapNullable(p.type);
            return {
              name: p.name,
              type,
              optional: p.optional,
              // ASP.NET binds complex types from the body and simple types from the route/query.
              fromBody: !SIMPLE_TYPES.has(type),
            };
          }),
        },
      ];
    });
}
