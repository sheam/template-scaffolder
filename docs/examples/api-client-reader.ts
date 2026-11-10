/**
 * Example: describe a generated (NSwag-style) TypeScript API client for templates,
 * using template-scaffolder's source reader instead of regular expressions.
 *
 * It returns the same shape as a hand-written regex parser used in a real project:
 *   { clientName, includePath, endpoints: [{ name, args, returnType, method, contentType }], interfaces }
 *
 * Use it from a config:
 *   variables: async ({ answers }) => ({ ENDPOINT_INFO: await getApiEndpointInformation(answers.ENDPOINT_PATH) })
 */
import path from 'node:path';
import {
  readSource,
  tsTypes,
  type ITypeDecl,
} from 'template-scaffolder/source';

export interface IFieldInfo {
  name: string;
  typeName: string;
}

export interface IInterfaceInfo {
  name: string;
  fields: IFieldInfo[];
}

export interface IEndpointInfo {
  name: string;
  args: IFieldInfo[];
  /** Name of the response DTO, e.g. 'IApiSuccessResponseDTOOfGetTanksResponseDTO'. */
  returnType: string;
  /** HTTP method found in the generated body, e.g. 'GET'. */
  method?: string;
  /** Type of the response's `Content` field, e.g. 'IGetTanksResponseDTO'. */
  contentType?: string;
}

export interface IApiInfo {
  clientName: string;
  includePath: string;
  endpoints: IEndpointInfo[];
  /** Interfaces in the file, minus the response wrappers the endpoints return. */
  interfaces: IInterfaceInfo[];
}

const toInterfaceInfo = (t: ITypeDecl): IInterfaceInfo => ({
  name: t.name,
  fields: t.fields.map(f => ({
    name: f.name,
    typeName: tsTypes.primaryType(f.type),
  })),
});

/**
 * @param file path of the generated client, relative to the project root
 * @param nameFilters keep only endpoints whose name contains one of these (case-insensitive)
 */
export async function getApiEndpointInformation(
  file: string,
  nameFilters: string[] = []
): Promise<IApiInfo> {
  const source = await readSource(file);
  // Files with only DTOs have no client class: no endpoints.
  const client = source.findTypes(
    t => t.kind === 'class' && t.methods.length > 0
  )[0];

  const interfaces = source.findTypes(t => t.kind === 'interface');
  const findInterface = (name: string): ITypeDecl | undefined =>
    interfaces.find(i => i.name === name);

  const endpoints = (client?.methods ?? [])
    // Public methods returning a promise; skips the generated process* helpers and the constructor.
    .filter(m => !m.access || m.access === 'public')
    .filter(m => m.returnType.startsWith('Promise<'))
    .filter(
      m =>
        nameFilters.length === 0 ||
        nameFilters.some(f => m.name.toLowerCase().includes(f.toLowerCase()))
    )
    .map((m): IEndpointInfo => {
      const returnType = tsTypes.unwrapPromise(m.returnType);
      const content = findInterface(returnType)?.fields.find(
        f => f.name === 'Content'
      );
      return {
        name: m.name,
        args: m.params.map(p => ({ name: p.name, typeName: p.type })),
        returnType,
        method: /method:\s*["'](\w+)["']/.exec(m.bodyText ?? '')?.[1],
        ...(content ? { contentType: tsTypes.primaryType(content.type) } : {}),
      };
    });

  const responseTypes = new Set(endpoints.map(e => e.returnType));
  return {
    clientName: client?.name ?? 'UnknownClient',
    includePath: `@data/endpoints/api/${path.parse(file).name}`,
    endpoints,
    interfaces: interfaces
      .filter(
        i => !responseTypes.has(i.name) && i.name !== 'IApiResponseDTOBase'
      )
      .map(toInterfaceInfo),
  };
}

/** Enum member names, e.g. for a `search` question's choices. */
export async function getEnumValues(
  file: string,
  enumName: string
): Promise<string[]> {
  return (await readSource(file)).enum(enumName).members.map(m => m.name);
}
