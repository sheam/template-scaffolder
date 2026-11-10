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
import { pythonReader } from '../../docs/examples/python-reader.js';
import {
  checkSourceReader,
  defineSourceReader,
  readSource,
  registerSourceReader,
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

  it('the custom reader in writing-a-source-reader.md produces a valid model', async () => {
    const doc = readFileSync(
      path.join(REPO_ROOT, 'docs/writing-a-source-reader.md'),
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

  it('python-reader reads classes, enums and functions', async () => {
    const file = `${F}/models.py`;
    const text = readFileSync(path.join(REPO_ROOT, file), 'utf-8');
    expect(await checkSourceReader(pythonReader, { path: file, text })).toEqual(
      []
    );

    registerSourceReader(pythonReader);
    const models = await readSource(file);
    expect(models.hasErrors).toBe(false);
    expect(models.enum('TankStatus').members).toEqual([
      { name: 'EMPTY', value: '"empty"' },
      { name: 'FERMENTING', value: '"fermenting"' },
    ]);

    const tank = models.class('Tank');
    expect(tank).toMatchObject({
      bases: ['BaseModel'],
      attributes: ['dataclass(frozen=True)'],
      doc: 'A brewing tank.',
    });
    expect(
      tank.fields.map(f => [f.name, f.type, f.optional, f.static])
    ).toEqual([
      ['table', 'ClassVar[str]', true, true],
      ['id', 'int', false, false],
      ['name', 'str', false, false],
      ['capacity', 'Optional[float]', true, false],
    ]);
    const [fill, parse, validate] = tank.methods;
    expect(fill).toMatchObject({
      name: 'fill',
      async: true,
      returnType: 'bool',
      doc: 'Fill the tank.',
      params: [
        { name: 'litres', type: 'float', optional: true, default: '10' },
        { name: 'force', type: 'bool', optional: true, default: 'False' },
      ],
    });
    expect(parse).toMatchObject({
      static: true,
      params: [{ name: 'raw', type: 'dict' }],
    });
    expect(validate.access).toBe('private');

    // A file mid-edit still yields what could be read.
    const broken = await pythonReader.read({
      path: 'broken.py',
      text: 'class Tank:\n    id: int\n    def fill(self, litres:\n',
    });
    expect(broken.hasErrors).toBe(true);
    expect(broken.types.map(t => t.name)).toEqual(['Tank']);

    expect(models.functions[0]).toMatchObject({
      name: 'list_tanks',
      returnType: 'list[Tank]',
      params: [
        { name: 'session', optional: false },
        { name: '*filters', optional: true },
        { name: 'limit', type: 'int', default: '50' },
        { name: '**options', optional: true },
      ],
    });
  });
});
