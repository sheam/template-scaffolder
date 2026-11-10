/**
 * Example: describe the public API of a C++ class from its header, e.g. to generate
 * language bindings, mocks or a test skeleton.
 *
 *   variables: async ({ answers }) => ({ API: await getPublicApi(answers.HEADER, answers.CLASS) })
 */
import { cppTypes, readSource } from 'template-scaffolder/source';

export interface IPublicApi {
  className: string;
  namespace: string;
  methods: {
    name: string;
    returnType: string;
    params: string[];
    isStatic: boolean;
  }[];
  fields: { name: string; type: string; elementType: string | null }[];
}

export async function getPublicApi(
  header: string,
  className: string
): Promise<IPublicApi> {
  const type = (await readSource(header)).class(className);
  const isConstructor = (name: string): boolean =>
    name === className || name === `~${className}`;
  return {
    className: type.name,
    namespace: type.namespace ?? '',
    methods: type.methods
      .filter(m => m.access === 'public' && !isConstructor(m.name))
      .map(m => ({
        name: m.name,
        returnType: cppTypes.stripQualifiers(m.returnType),
        params: m.params.map(p => `${p.type} ${p.name}`),
        isStatic: m.static,
      })),
    fields: type.fields
      .filter(f => f.access === 'public')
      .map(f => ({
        name: f.name,
        type: f.type,
        elementType: cppTypes.elementType(f.type),
      })),
  };
}
