import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUILT_IN_READERS,
  checkSourceReader,
  defineSourceReader,
  readSource,
  readSources,
  registerSourceReader,
  sourceRegistry,
} from '../../src/source/api.js';
import { cppTypes, csharpTypes, tsTypes } from '../../src/source/index.js';
import { REPO_ROOT } from '../helpers.js';
import type { ISourceFile } from '../../src/source/types.js';

const FIXTURES = 'test/fixtures/source';
const sample = (file: string): { path: string; text: string } => ({
  path: `${FIXTURES}/${file}`,
  text: readFileSync(path.join(REPO_ROOT, FIXTURES, file), 'utf-8'),
});

beforeAll(() => sourceRegistry.reset(REPO_ROOT));

const sig = (f: ISourceFile['functions'][number]): string =>
  `${f.name}(${f.params.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ')}): ${f.returnType}`;

describe('reader contract', () => {
  const samples: Record<string, string> = {
    typescript: 'TanksClient.ts',
    csharp: 'TanksController.cs',
    cpp: 'Tank.hpp',
  };
  for (const reader of BUILT_IN_READERS) {
    it(`${reader.id} output matches the model`, async () => {
      expect(
        await checkSourceReader(reader, sample(samples[reader.id]))
      ).toEqual([]);
    });
  }
});

describe('TypeScript reader', () => {
  let f: ISourceFile;
  beforeAll(async () => {
    f = await readSource(`${FIXTURES}/TanksClient.ts`);
  });

  it('reads enums with and without values', () => {
    expect(f.enum('TankType').members).toEqual([
      { name: 'Fermenter', value: "'Fermenter'" },
      { name: 'BrightTank', value: "'BrightTank'" },
      { name: 'Kettle', value: '3' },
    ]);
    expect(f.enum('TankType').doc).toBe('Tank kinds.');
  });

  it('reads interfaces with optional and readonly fields and bases', () => {
    const dto = f.interface('ITankDTO');
    expect(
      dto.fields.map(x => [x.name, x.type, x.optional, x.readonly])
    ).toEqual([
      ['TankId', 'number', false, false],
      ['Name', 'string | undefined', true, false],
      ['Type', 'TankType', false, true],
    ]);
    expect(
      f.interface('IApiSuccessResponseDTOOfGetTanksResponseDTO').bases
    ).toEqual(['IApiSuccessResponseDTO']);
  });

  it('reads class methods with params, return types, modifiers and body text', () => {
    const client = f.class('TanksApiClient');
    expect(client.bases).toEqual(['BaseApiClient', 'IClient']);
    expect(client.methods.map(sig)).toEqual([
      'getTanks(pageSize: number, pageNumber?: number | undefined): Promise<IApiSuccessResponseDTOOfGetTanksResponseDTO>',
      'deleteTank(tankId: number): Promise<void>',
      'processGetTanks(response: Response): Promise<void>',
    ]);
    const process = client.methods[2];
    expect([process.access, process.static, process.async]).toEqual([
      'protected',
      true,
      true,
    ]);
    expect(
      /method:\s*"(\w+)"/.exec(client.methods[0].bodyText ?? '')?.[1]
    ).toBe('GET');
    expect(client.methods[0].doc).toBe('Fetch one page of tanks.');
    expect(client.fields[0]).toMatchObject({
      name: 'baseUrl',
      access: 'private',
      readonly: true,
    });
  });

  it('reads aliases, free functions, arrow functions and namespaces', () => {
    expect(f.type('TankStatus')).toMatchObject({
      kind: 'union',
      aliasOf: "'empty' | 'full'",
    });
    expect(f.functions.map(sig)).toEqual([
      'helper(a: string, b?: ): Promise<number>',
      'arrow(x: number): string',
    ]);
    expect(f.functions[0].params[1].default).toBe('2');
    expect(f.findType('IOld')).toMatchObject({
      namespace: 'Legacy',
      exported: true,
    });
  });

  it('throws a helpful error for a missing type', () => {
    expect(() => f.enum('Nope')).toThrow(
      /No enum named 'Nope' in test\/fixtures\/source\/TanksClient.ts. Found: TankType/
    );
  });
});

describe('C# reader', () => {
  let f: ISourceFile;
  beforeAll(async () => {
    f = await readSource(`${FIXTURES}/TanksController.cs`);
  });

  it('records file-scoped and nested namespaces', () => {
    expect(f.namespaces).toEqual(['Brew.Api.Tanks', 'Brew.Api.Tanks.Nested']);
    expect(f.type('Point').namespace).toBe('Brew.Api.Tanks.Nested');
  });

  it('reads enums, records and properties', () => {
    expect(f.enum('TankType')).toMatchObject({
      bases: ['byte'],
      doc: '<summary>Kinds of tank.</summary>',
    });
    expect(f.enum('TankType').members).toEqual([
      { name: 'Fermenter', value: '1' },
      { name: 'BrightTank' },
    ]);
    expect(f.class('TankDto')).toMatchObject({ kind: 'record' });
    expect(
      f.class('TankDto').fields.map(x => [x.name, x.type, x.optional])
    ).toEqual([
      ['TankId', 'int', false],
      ['Name', 'string?', true],
    ]);
    const req = f.class('UpdateTankRequest');
    expect(req.fields.map(x => [x.name, x.type, x.readonly, x.access])).toEqual(
      [
        ['TankId', 'int', false, 'public'],
        ['Name', 'string', false, 'public'],
        ['IngredientIds', 'List<int>?', false, 'public'],
        ['Version', 'int', true, 'public'],
        ['_logger', 'ILogger', true, 'private'],
        ['MaxNameLength', 'int', true, 'public'],
      ]
    );
  });

  it('reads controller attributes, methods and parameters', () => {
    const c = f.class('TanksController');
    expect(c.attributes).toEqual(['ApiController', 'Route("api/tanks")']);
    expect(c.bases).toEqual(['ControllerBase', 'ITanksController']);
    expect(c.methods.map(sig)).toEqual([
      'GetTanks(pageSize: int, pageNumber?: int?): Task<ActionResult<List<TankDto>>>',
      'DeleteTank(tankId: int): Task',
      'Helper(): int',
    ]);
    expect(c.methods[0]).toMatchObject({
      async: true,
      attributes: ['HttpGet'],
    });
    expect(c.methods[0].params[1].default).toBe('null');
    expect(c.methods[1].attributes).toEqual(['HttpDelete("{tankId}")']);
    expect(c.methods[2]).toMatchObject({
      static: true,
      access: 'private',
      bodyText: '1',
    });
  });

  it('reads generic interfaces', () => {
    const i = f.interface('ITanksController');
    expect(i.typeParams).toEqual(['T']);
    expect(i.methods.map(sig)).toEqual(['Get(id: int): Task<T>']);
    expect(i.fields[0]).toMatchObject({ name: 'Name', readonly: true });
  });

  it('has type helpers', () => {
    expect(csharpTypes.unwrapTask('Task<ActionResult<List<TankDto>>>')).toBe(
      'ActionResult<List<TankDto>>'
    );
    expect(csharpTypes.unwrapActionResult('ActionResult<List<TankDto>>')).toBe(
      'List<TankDto>'
    );
    expect(csharpTypes.elementType('List<TankDto>?')).toBe('TankDto');
    expect(csharpTypes.unwrapTask('Task')).toBe('void');
  });
});

describe('C++ reader', () => {
  let f: ISourceFile;
  beforeAll(async () => {
    f = await readSource(`${FIXTURES}/Tank.hpp`);
  });

  it('reads enums, enum classes and nested namespaces inside include guards', () => {
    expect(f.namespaces).toEqual(['brew::model']);
    expect(f.enum('TankType')).toMatchObject({
      bases: ['int'],
      namespace: 'brew::model',
      doc: 'Kinds of tank.',
    });
    expect(f.enum('Legacy').members).toEqual([
      { name: 'A' },
      { name: 'B', value: '2' },
    ]);
  });

  it('reads template classes with access sections', () => {
    const t = f.class('Tank');
    expect(t.typeParams).toEqual(['typename T']);
    expect(t.bases).toEqual(['Vessel', 'Tracked<T>']);
    expect(t.doc).toBe('A tank holding items of type T.');
    expect(t.methods.map(m => `${m.access} ${sig(m)}`)).toEqual([
      'public Tank(id: int): ',
      'public ~Tank(): ',
      'public count(): int',
      'public name(): const std::string&',
      'public fill(amount: int, rate?: double): void',
    ]);
    expect(t.methods[2].static).toBe(true);
    expect(t.fields.map(x => `${x.access} ${x.type} ${x.name}`)).toEqual([
      'public std::vector<T> items',
      'protected int capacity',
      'private int m_id',
      'private T* m_current',
    ]);
  });

  it('reads structs with several declarators, free functions and aliases', () => {
    expect(f.class('Point').fields.map(x => x.name)).toEqual(['x', 'y']);
    expect(f.functions.map(sig)).toEqual([
      'freeFunction(p: const Point&): int',
      'defaultType(): TankType',
    ]);
    expect(f.type('TankList')).toMatchObject({
      kind: 'alias',
      aliasOf: 'std::vector<Tank<int>>',
    });
  });

  it('has type helpers', () => {
    expect(cppTypes.stripQualifiers('const std::string&')).toBe('std::string');
    expect(cppTypes.elementType('std::vector<Tank<int>>')).toBe('Tank<int>');
    expect(cppTypes.unwrapWrapper('std::unique_ptr<Tank>')).toBe('Tank');
  });
});

describe('registry', () => {
  it('reads many files with a glob and caches parses', async () => {
    const files = await readSources(`${FIXTURES}/*.{ts,cs}`);
    expect(files.map(x => x.path.split('/').pop())).toEqual([
      'TanksClient.ts',
      'TanksController.cs',
    ]);
    expect(await readSource(`${FIXTURES}/TanksClient.ts`)).toBe(
      await readSource(`${FIXTURES}/TanksClient.ts`)
    );
  });

  it('uses custom readers by extension and by id', async () => {
    registerSourceReader(
      defineSourceReader({
        id: 'lines',
        extensions: ['.hpp'],
        async read({ path: p, text }) {
          return {
            path: p,
            language: 'lines',
            text,
            types: [],
            functions: [],
            namespaces: text.split('\n').slice(0, 1),
            hasErrors: false,
          };
        },
      })
    );
    sourceRegistry.reset(REPO_ROOT);
    expect((await readSource(`${FIXTURES}/Tank.hpp`)).language).toBe('lines');
    expect(
      (await readSource(`${FIXTURES}/Tank.hpp`, { reader: 'cpp' })).language
    ).toBe('cpp');
    await expect(
      readSource(`${FIXTURES}/Tank.hpp`, { reader: 'nope' })
    ).rejects.toThrow(/No source reader with id 'nope'/);
    await expect(readSource('README.md')).rejects.toThrow(
      /No source reader for 'README.md'/
    );
  });

  it('has TypeScript type helpers', () => {
    expect(tsTypes.primaryType('ITankDTO[] | undefined')).toBe('ITankDTO[]');
    expect(tsTypes.unwrapArray('ITankDTO[]')).toBe('ITankDTO');
    expect(tsTypes.unwrapPromise('Promise<Map<string, number>>')).toBe(
      'Map<string, number>'
    );
    expect(tsTypes.splitTopLevel('A<B | C> | D', '|')).toEqual([
      'A<B | C>',
      'D',
    ]);
  });
});
