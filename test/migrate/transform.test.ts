import { describe, expect, it } from 'vitest';
import { migrateSource } from '../../src/migrate/transform.js';

const migrate = async (
  text: string,
  file = 'scaffolding.config.ts',
  ignoreFiles: string[] = []
) => migrateSource(text, file, { ignoreFiles });

describe('migrateSource', () => {
  it('converts a BrewNinja-style shared defaults helper', async () => {
    const before = `import {IConfigFile} from 'template-scaffolder/dist/types';
import {formatFileCommand, lowerFirst} from './helpers';

export function getDefaultConfig<TUserInput extends object>(): IConfigFile<TUserInput> {
  return {
    afterFileCreated: formatFileCommand,
    stripLines: [/STRIP/],
    macros: { lowerFirst },
  };
}
`;
    const { text, changes, problems } = await migrate(
      before,
      '_helpers/defaultConfig.ts'
    );
    expect(text).toBe(`import {IConfigFile} from 'template-scaffolder';
import {formatFileCommand, lowerFirst} from './helpers';

export function getDefaultConfig<TUserInput extends object>(): IConfigFile<TUserInput> {
  return {
    hooks: { afterFileCreated: ({ path, dryRun, variables }) => formatFileCommand(path, dryRun, variables) },
    stripLines: [/STRIP/],
    macros: { lowerFirst },
  };
}
`);
    expect(changes).toHaveLength(2);
    expect(problems).toEqual([]);
  });

  it('converts typed functions, moves types onto the context and imports them', async () => {
    const before = `import {IConfigFile, Question} from 'template-scaffolder/dist/types';
import {getDefaultConfig} from '../_helpers/defaultConfig';

interface IUserInputs { ENDPOINT_PATH: string }

export default {
  ...getDefaultConfig<IUserInputs>(),
  destinations: 'src/pages',
  variables: async (name: string, inputs: IUserInputs) => ({
    LNAME: name.toLowerCase(),
    PATH: inputs.ENDPOINT_PATH,
  }),
  prompts: async (name: string): Promise<Question<IUserInputs>[]> => [
    { name: 'ENDPOINT_PATH', type: 'fuzzypath', message: 'file', maxDepth: 1 },
    { name: 'KIND', type: 'list', message: 'kind', choices: [] },
  ],
  macros: (_name: string, _inputs: IUserInputs, variables) => ({ v: () => variables.LNAME }),
} as IConfigFile<IUserInputs>;
`;
    const { text } = await migrate(before);
    expect(text)
      .toBe(`import {IConfigFile, Question, type IMacrosContext, type IPromptsContext, type IVariablesContext } from 'template-scaffolder';
import {getDefaultConfig} from '../_helpers/defaultConfig';

interface IUserInputs { ENDPOINT_PATH: string }

export default {
  ...getDefaultConfig<IUserInputs>(),
  destination: 'src/pages',
  variables: async ({ name, answers: inputs }: IVariablesContext<IUserInputs>) => ({
    LNAME: name.toLowerCase(),
    PATH: inputs.ENDPOINT_PATH,
  }),
  prompts: async ({ name }: IPromptsContext): Promise<Question<IUserInputs>[]> => [
    { name: 'ENDPOINT_PATH', type: 'path', message: 'file', depthLimit: 1 },
    { name: 'KIND', type: 'select', message: 'kind', choices: [] },
  ],
  macros: ({ name: _name, answers: _inputs, variables }: IMacrosContext<IUserInputs>) => ({ v: () => variables.LNAME }),
} as IConfigFile<IUserInputs>;
`);
  });

  it('handles const-then-export, method shorthand, bare params and module.exports', async () => {
    const esm = await migrate(
      `const config = {
  variables(name, inputs = {}) { return { A: name, B: inputs.B }; },
  prompts: name => [{ name: 'B', message: name }],
};
export default config;
`,
      'scaffolding.config.mjs'
    );
    expect(esm.text).toBe(`const config = {
  variables({ name, answers: inputs = {} }) { return { A: name, B: inputs.B }; },
  prompts: ({ name }) => [{ name: 'B', message: name }],
};
export default config;
`);
    const cjs = await migrate(
      `module.exports = { variables: (n) => ({ X: n }) };\n`,
      'scaffolding.config.cjs'
    );
    expect(cjs.text).toBe(
      `module.exports = { variables: ({ name: n }) => ({ X: n }) };\n`
    );
  });

  it('passes only as many arguments as a known helper declares', async () => {
    const { text } = await migrateSource(
      `export default { afterFileCreated: formatFileCommand, variables: makeVars };\n`,
      'scaffolding.config.ts',
      { arities: { formatFileCommand: 2, makeVars: 1 } }
    );
    expect(text).toBe(
      `export default { hooks: { afterFileCreated: ({ path, dryRun }) => formatFileCommand(path, dryRun) }, variables: ({ name }) => makeVars(name) };\n`
    );
  });

  it('adds ignore for template-local helpers', async () => {
    const { text } = await migrate(
      `import {h} from './helpers.js';
export default {
    name: 'x',
};
`,
      'scaffolding.config.mjs',
      ['helpers.js']
    );
    expect(text).toContain(
      `export default {\n    ignore: ['helpers.js'],\n    name: 'x',`
    );
  });

  it('reports what it cannot convert and leaves it alone', async () => {
    const { text, problems } = await migrate(
      `export default {
  variables: function (name) { return { all: arguments.length }; },
  macros: makeMacros(),
  afterFileCreated: (p) => [],
  hooks: {},
};
`,
      'scaffolding.config.js'
    );
    expect(problems.map(p => p.line)).toEqual([2, 3, 4]);
    expect(text).toContain('function (name)');
  });

  it('is idempotent', async () => {
    const once = await migrate(
      `export default { variables: (name, a) => ({}), afterFileCreated: (p, d, v) => [] };\n`,
      'scaffolding.config.js'
    );
    const twice = await migrate(once.text, 'scaffolding.config.js');
    expect(twice.text).toBe(once.text);
    expect(twice.changes).toEqual([]);
  });

  it('only rewrites relative imports that bring in package types', async () => {
    const { text } = await migrate(
      `import { IConfigFile } from '../../src/types';\nimport { IThing } from '../types';\nexport default {} as IConfigFile;\n`
    );
    expect(text).toBe(
      `import { IConfigFile } from 'template-scaffolder';\nimport { IThing } from '../types';\nexport default {} as IConfigFile;\n`
    );
  });
});
