import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { resetUserNameCache } from '../../src/core/builtIns.js';
import { ScaffolderError } from '../../src/core/errors.js';
import { lastRunPath } from '../../src/core/lastRun.js';
import { run } from '../../src/core/run.js';
import { createAnswerPrompter, scaffold } from '../../src/index.js';
import {
  memoryReporter,
  readTree,
  scriptedPrompter,
  tempProject,
  writeFiles,
} from '../helpers.js';
import type { IRunDeps } from '../../src/core/run.js';

beforeAll(() => {
  process.env.GIT_CONFIG_GLOBAL = path.join(tempProject(), 'none');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  process.env.USERNAME = 'Test User';
  resetUserNameCache();
});

function deps(
  projectRoot: string,
  answers: Record<string, unknown> = {}
): IRunDeps & {
  prompter: ReturnType<typeof scriptedPrompter>;
  reporter: ReturnType<typeof memoryReporter>;
} {
  return {
    projectRoot,
    prompter: scriptedPrompter(answers),
    reporter: memoryReporter(),
  };
}

describe('run() with the in-repo fixtures', () => {
  it('generates the typescript-component template, asking only for the destination', async () => {
    const root = tempProject({
      dirs: ['src/testdir/subdir1', 'src/testdir/subdir2'],
    });
    const d = deps(root, { destination: 'src/testdir/subdir2' });
    const result = await run(
      { template: 'typescript-component', name: 'Widget' },
      d
    );

    expect(d.prompter.asked.map(q => q.name)).toEqual(['destination']);
    // In template-file order: '${NAME}.test.tsx' sorts before 'Output.ts'.
    expect(result.files.map(f => [f.path, f.status])).toEqual([
      ['src/testdir/subdir2/Widget/Widget.test.tsx', 'created'],
      ['src/testdir/subdir2/Widget/Output.ts', 'created'],
    ]);
    expect(
      readFileSync(
        path.join(root, 'src/testdir/subdir2/Widget/Output.ts'),
        'utf-8'
      )
    ).toContain("return 'Widget';");
    expect(result.hasErrors).toBe(false);
  });

  it('asks for the template and name when not given, and uses the config name to find templates', async () => {
    const root = tempProject({ dirs: ['out'] });
    const d = deps(root, {
      template: 'conversion',
      name: 'Thing',
      PromptedType: 'Date',
    });
    const result = await run({ destination: 'out' }, d);
    expect(d.prompter.asked.map(q => q.name)).toEqual([
      'template',
      'name',
      'PromptedType',
    ]);
    expect(result.template).toBe('conversion');

    const byConfigName = await run(
      { template: 'Simple', name: 'X', destination: 'out' },
      deps(root)
    );
    expect(byConfigName.template).toBe('typescript-component');
  });

  it('dry run renders but writes nothing and runs no commands', async () => {
    const root = tempProject({ dirs: ['out'] });
    const result = await run(
      { template: 'conversion', name: 'Dry', destination: 'out', dryRun: true },
      deps(root, { PromptedType: 'number' })
    );
    expect(result.files.every(f => f.content)).toBe(true);
    expect(readTree(path.join(root, 'out'))).toEqual({});
  });

  it('skips existing files unless overwrite is set', async () => {
    const root = tempProject({ dirs: ['out'] });
    writeFiles(root, { 'out/Name/types.ts': 'original' });
    const opts = { template: 'conversion', name: 'Name', destination: 'out' };
    const first = await run(opts, deps(root, { PromptedType: 'A' }));
    expect(first.files.find(f => f.path.endsWith('types.ts'))?.status).toBe(
      'skipped'
    );
    expect(readFileSync(path.join(root, 'out/Name/types.ts'), 'utf-8')).toBe(
      'original'
    );

    const second = await run(
      { ...opts, overwrite: true },
      deps(root, { PromptedType: 'A' })
    );
    expect(second.files.find(f => f.path.endsWith('types.ts'))?.status).toBe(
      'overwritten'
    );
  });

  it('rerun replays answers, keeps false and 0, and lets explicit options win', async () => {
    const root = tempProject({ dirs: ['out', 'other'] });
    writeFiles(root, {
      'scaffolding/flags/scaffolding.config.mjs': `export default {
        prompts: [
          { name: 'ENABLED', type: 'confirm', message: 'enabled?' },
          { name: 'COUNT', type: 'number', message: 'count?' },
        ],
      };`,
      'scaffolding/flags/out.txt': '$ENABLED/$COUNT',
    });
    await run(
      { template: 'flags', name: 'A', destination: 'out' },
      deps(root, { ENABLED: false, COUNT: 0 })
    );
    expect(
      JSON.parse(readFileSync(lastRunPath(root), 'utf-8')).answers
    ).toEqual({
      ENABLED: false,
      COUNT: 0,
    });

    const replay = deps(root);
    const result = await run({ rerun: true, destination: 'other' }, replay);
    expect(replay.prompter.asked).toEqual([]);
    expect(result.destination).toBe('other');
    expect(readFileSync(path.join(root, 'other/A/out.txt'), 'utf-8')).toBe(
      'false/0'
    );
  });

  it('reads a 2.x last-run file', async () => {
    const root = tempProject({ dirs: ['out'] });
    writeFiles(root, {
      '.template-scaffolder-last-run': JSON.stringify({
        lastRunConfigFormatVersion: '1.0',
        name: 'Old',
        destination: 'out',
        args: { template: 'conversion' },
        promptResults: [{ name: 'PromptedType', answer: 'Date' }],
      }),
    });
    const result = await run({ rerun: true }, deps(root));
    expect(result.answers).toEqual({ PromptedType: 'Date' });
  });

  it('asks a follow-up path question when "Other" destination is chosen', async () => {
    const root = tempProject({ dirs: ['src/testdir/subdir1', 'elsewhere'] });
    const answers = ['\0other', 'elsewhere'];
    const asked: string[] = [];
    const result = await run(
      { template: 'typescript-component', name: 'W' },
      {
        projectRoot: root,
        reporter: memoryReporter(),
        prompter: {
          async ask(q) {
            asked.push(q.type ?? 'input');
            return answers.shift();
          },
        },
      }
    );
    expect(asked).toEqual(['select', 'path']);
    expect(result.destination).toBe('elsewhere');
  });

  it('fails clearly for a missing destination directory', async () => {
    const root = tempProject();
    await expect(
      run(
        { template: 'conversion', name: 'X', destination: 'nope' },
        deps(root, { PromptedType: 'A' })
      )
    ).rejects.toMatchObject({ code: 'DESTINATION_INVALID' });
  });
});

describe('hooks, ignore, CURRENT_FILE_PATH and words', () => {
  it('runs hooks in order and passes created paths to afterRun', async () => {
    const root = tempProject({ dirs: ['out'] });
    writeFiles(root, {
      'scaffolding/hooked/scaffolding.config.mjs': `
        export const calls = [];
        export default {
          ignore: ['helpers.mjs', 'notes/**'],
          prompts: [{ name: 'TAGS', type: 'words', message: 'tags', separator: ',' }],
          hooks: {
            beforeRun: ({ answers }) => { globalThis.__calls = ['before:' + answers.TAGS.join('|')]; },
            afterFileCreated: ({ path, dryRun }) => { globalThis.__calls.push('file:' + path); return ['echo ' + path.split('/').pop()]; },
            afterRun: ({ createdPaths }) => { globalThis.__calls.push('run:' + createdPaths.length); return ['echo done']; },
          },
        };`,
      'scaffolding/hooked/helpers.mjs': 'export const x = 1;',
      'scaffolding/hooked/notes/readme.md': 'not a template',
      'scaffolding/hooked/${NAME}.txt':
        '$CURRENT_FILE_PATH #foreach($t in $TAGS)[$t]#end',
    });
    const result = await run(
      { template: 'hooked', name: 'H', destination: 'out' },
      deps(root, { TAGS: ['a', 'b'] })
    );
    expect(result.files.map(f => f.path)).toEqual(['out/H/H.txt']);
    expect(readFileSync(path.join(root, 'out/H/H.txt'), 'utf-8')).toBe(
      'out/H/H.txt [a][b]'
    );
    expect((globalThis as Record<string, unknown>).__calls).toEqual([
      'before:a|b',
      'file:out/H/H.txt',
      'run:1',
    ]);
    expect(result.files[0].commands).toEqual([
      { command: 'echo H.txt', exitCode: 0, output: 'H.txt' },
    ]);
    expect(result.afterRunCommands[0]).toMatchObject({
      command: 'echo done',
      exitCode: 0,
    });
  });

  it('accepts a 2.x top-level afterFileCreated with a deprecation warning', async () => {
    const root = tempProject({ dirs: ['out'] });
    writeFiles(root, {
      'scaffolding/legacy/scaffolding.config.mjs': `export default {
        afterFileCreated: (path, dryRun, vars) => ['echo ' + vars.NAME + ' ' + dryRun],
      };`,
      'scaffolding/legacy/a.txt': 'a',
    });
    const d = deps(root);
    const result = await run(
      { template: 'legacy', name: 'L', destination: 'out' },
      d
    );
    expect(result.files[0].commands[0]).toMatchObject({ output: 'L false' });
    expect(d.reporter.warnings.join()).toMatch(/afterFileCreated.*deprecated/);
  });

  it('reports a failing template file without stopping the others', async () => {
    const root = tempProject({ dirs: ['out'] });
    writeFiles(root, {
      'scaffolding/broken/scaffolding.config.mjs':
        'export default { macros: { boom: () => { throw new Error("kaboom"); } } };',
      'scaffolding/broken/bad.txt': '#boom()',
      'scaffolding/broken/good.txt': 'fine',
    });
    const result = await run(
      { template: 'broken', name: 'B', destination: 'out', parallel: true },
      deps(root)
    );
    expect(result.files.map(f => f.status)).toEqual(['error', 'created']);
    expect(result.files[0].reason).toMatch(/kaboom/);
    expect(result.hasErrors).toBe(true);
  });

  it('detects #include cycles', async () => {
    const root = tempProject({ dirs: ['out'] });
    writeFiles(root, {
      'scaffolding/_includes/a.txt': '#include(b.txt)',
      'scaffolding/_includes/b.txt': '#include(a.txt)',
      'scaffolding/cyc/scaffolding.config.mjs': 'export default {};',
      'scaffolding/cyc/x.txt': '#include(a.txt)',
    });
    const result = await run(
      { template: 'cyc', name: 'C', destination: 'out' },
      deps(root)
    );
    expect(result.files[0].reason).toMatch(
      /#include cycle: x.txt -> a.txt -> b.txt -> a.txt/
    );
  });
});

describe('config errors', () => {
  it('rejects 2.x positional variables() with a migrate hint', async () => {
    const root = tempProject({ dirs: ['out'] });
    writeFiles(root, {
      'scaffolding/old/scaffolding.config.mjs':
        'export default { variables: (name, inputs) => ({}) };',
    });
    const err = await run(
      { template: 'old', name: 'O', destination: 'out' },
      deps(root)
    ).catch(e => e);
    expect(err).toBeInstanceOf(ScaffolderError);
    expect(err.details.join()).toMatch(/scaffolder migrate/);
  });

  it('lists every invalid prompt', async () => {
    const root = tempProject({ dirs: ['out'] });
    writeFiles(root, {
      'scaffolding/badq/scaffolding.config.mjs': `export default { prompts: [
        { name: 'A', type: 'select', message: 'a' },
        { name: 'B', type: 'search', message: 'b', choices: [], source: () => [] },
        { name: 'C', type: 'nope', message: 'c' },
      ] };`,
    });
    const err = await run(
      { template: 'badq', name: 'Q', destination: 'out' },
      deps(root)
    ).catch(e => e);
    expect(err.code).toBe('CONFIG_INVALID');
    expect(err.details).toHaveLength(3);
  });
});

describe('scaffold() programmatic API', () => {
  it('runs without interaction using answers and defaults', async () => {
    const root = tempProject({ dirs: ['out'] });
    const result = await scaffold({
      projectRoot: root,
      template: 'conversion',
      name: 'Api',
      destination: 'out',
      answers: { PromptedType: 'bigint' },
    });
    expect(result.files).toHaveLength(2);
    expect(existsSync(path.join(root, 'out/Api/types.ts'))).toBe(true);
  });

  it('fails with MISSING_ANSWER when a required answer is missing', async () => {
    await expect(
      createAnswerPrompter().ask({ name: 'X', message: 'x?', required: true })
    ).rejects.toMatchObject({ code: 'MISSING_ANSWER' });
  });
});
