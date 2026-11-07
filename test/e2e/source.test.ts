import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../../src/core/run.js';
import {
  memoryReporter,
  REPO_ROOT,
  scriptedPrompter,
  tempProject,
  writeFiles,
} from '../helpers.js';

describe('source readers from templates', () => {
  it('works through ctx.source and through imports in helper files', async () => {
    const root = tempProject({ dirs: ['out', 'src'] });
    for (const f of ['TanksClient.ts', 'TanksController.cs', 'Tank.hpp']) {
      writeFiles(root, {
        [`src/${f}`]: readFileSync(
          path.join(REPO_ROOT, 'test/fixtures/source', f),
          'utf-8'
        ),
      });
    }
    writeFiles(root, {
      'scaffolding/_helpers/endpoints.ts': `
        import { readSource, tsTypes } from 'template-scaffolder/source';
        export async function getEndpoints(file: string) {
          const client = (await readSource(file)).findTypes(t => t.name.endsWith('ApiClient'))[0];
          return client.methods
            .filter(m => !m.name.startsWith('process'))
            .map(m => ({
              name: m.name,
              method: /method:\\s*"(\\w+)"/.exec(m.bodyText ?? '')?.[1] ?? '',
              content: tsTypes.unwrapPromise(m.returnType),
            }));
        }`,
      'scaffolding/api/scaffolding.config.ts': `
        import { defineConfig } from 'template-scaffolder';
        import { getEndpoints } from '../_helpers/endpoints.js';
        export default defineConfig<{ ROLE: string }>({
          prompts: async ({ source }) => [{
            name: 'ROLE', type: 'select', message: 'role',
            choices: (await source.read('src/TanksClient.ts')).enum('TankType').members.map(m => ({ value: m.name })),
          }],
          variables: async ({ source }) => ({
            ENDPOINTS: await getEndpoints('src/TanksClient.ts'),
            ACTIONS: (await source.read('src/TanksController.cs')).class('TanksController').methods.map(m => m.name),
            FIELDS: (await source.read('src/Tank.hpp')).class('Tank').fields.map(f => f.name),
          }),
        });`,
      'scaffolding/api/out.txt':
        '$ROLE|#foreach($e in $ENDPOINTS)$e.method:$e.name #end|#foreach($a in $ACTIONS)$a #end|#foreach($f in $FIELDS)$f #end',
    });
    const prompter = scriptedPrompter({ ROLE: 'Kettle' });
    await run(
      { template: 'api', name: 'Api', destination: 'out' },
      { projectRoot: root, prompter, reporter: memoryReporter() }
    );
    expect(prompter.asked[0]).toMatchObject({
      choices: [
        { value: 'Fermenter' },
        { value: 'BrightTank' },
        { value: 'Kettle' },
      ],
    });
    expect(readFileSync(path.join(root, 'out/Api/out.txt'), 'utf-8')).toBe(
      'Kettle|GET:getTanks DELETE:deleteTank |GetTanks DeleteTank Helper |items capacity m_id m_current '
    );
  });
});
