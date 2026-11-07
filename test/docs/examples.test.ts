// The examples in docs/ must keep working.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  getApiEndpointInformation,
  getEnumValues,
} from '../../docs/examples/api-client-reader.js';
import { getPublicApi } from '../../docs/examples/cpp-header.js';
import { getControllerActions } from '../../docs/examples/csharp-controller.js';
import {
  checkSourceReader,
  defineSourceReader,
  sourceRegistry,
} from '../../src/source/api.js';
import { REPO_ROOT } from '../helpers.js';

const F = 'test/fixtures/source';
beforeAll(() => sourceRegistry.reset(REPO_ROOT));

describe('docs/examples', () => {
  it('api-client-reader describes an NSwag-style client', async () => {
    const info = await getApiEndpointInformation(`${F}/TanksClient.ts`);
    expect(info.clientName).toBe('TanksApiClient');
    expect(info.endpoints).toEqual([
      {
        name: 'getTanks',
        args: [
          { name: 'pageSize', typeName: 'number' },
          { name: 'pageNumber', typeName: 'number | undefined' },
        ],
        returnType: 'IApiSuccessResponseDTOOfGetTanksResponseDTO',
        method: 'GET',
        contentType: 'IGetTanksResponseDTO',
      },
      {
        name: 'deleteTank',
        args: [{ name: 'tankId', typeName: 'number' }],
        returnType: 'void',
        method: 'DELETE',
      },
    ]);
    expect(info.interfaces.map(i => i.name)).toEqual([
      'IGetTanksResponseDTO',
      'ITankDTO',
      'IOld',
    ]);
    expect(await getEnumValues(`${F}/TanksClient.ts`, 'TankType')).toEqual([
      'Fermenter',
      'BrightTank',
      'Kettle',
    ]);
  });

  it('csharp-controller lists actions', async () => {
    expect(await getControllerActions(`${F}/TanksController.cs`)).toEqual([
      {
        name: 'GetTanks',
        verb: 'GET',
        route: 'api/tanks',
        resultType: 'List<TankDto>',
        params: [
          { name: 'pageSize', type: 'int', optional: false, fromBody: false },
          { name: 'pageNumber', type: 'int', optional: true, fromBody: false },
        ],
      },
      {
        name: 'DeleteTank',
        verb: 'DELETE',
        route: 'api/tanks/{tankId}',
        resultType: 'void',
        params: [
          { name: 'tankId', type: 'int', optional: false, fromBody: false },
        ],
      },
    ]);
  });

  it('cpp-header describes the public API', async () => {
    expect(await getPublicApi(`${F}/Tank.hpp`, 'Tank')).toEqual({
      className: 'Tank',
      namespace: 'brew::model',
      methods: [
        { name: 'count', returnType: 'int', params: [], isStatic: true },
        {
          name: 'name',
          returnType: 'std::string',
          params: [],
          isStatic: false,
        },
        {
          name: 'fill',
          returnType: 'void',
          params: ['int amount', 'double rate'],
          isStatic: false,
        },
      ],
      fields: [{ name: 'items', type: 'std::vector<T>', elementType: 'T' }],
    });
  });

  it('the custom reader in source-readers.md produces a valid model', async () => {
    const doc = readFileSync(
      path.join(REPO_ROOT, 'docs/source-readers.md'),
      'utf-8'
    );
    const code =
      /```ts\n\/\/ scaffolding\/_helpers\/protoReader.ts\n([\s\S]*?)```/.exec(
        doc
      )?.[1];
    expect(code).toBeTruthy();
    // Evaluate the snippet with defineSourceReader in scope.
    const body = code!
      .replace(/^import .*\n/m, '')
      .replace(/ as const/g, '') // TypeScript-only syntax
      .replace('export const protoReader =', 'return');
    const protoReader = new Function('defineSourceReader', body)(
      defineSourceReader
    );
    const text =
      'message Tank {\n  int32 id = 1;\n  optional string name = 2;\n}\n';
    expect(
      await checkSourceReader(protoReader, { path: 'x.proto', text })
    ).toEqual([]);
    const data = await protoReader.read({ path: 'x.proto', text });
    expect(
      data.types[0].fields.map((f: { name: string; optional: boolean }) => [
        f.name,
        f.optional,
      ])
    ).toEqual([
      ['id', false],
      ['name', true],
    ]);
  });
});
