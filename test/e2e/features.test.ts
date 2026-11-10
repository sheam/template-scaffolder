// New in 3.0: unknown-variable warnings, keepLineBreaks, answer conversion, hook
// context and errors, creating destinations, init and list.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { priorAnswer } from '../../src/core/answers.js';
import { resetUserNameCache } from '../../src/core/builtIns.js';
import { initScaffolding } from '../../src/core/init.js';
import { lastRunPath } from '../../src/core/lastRun.js';
import { keepLineBreak, renderVelocity } from '../../src/core/render.js';
import { run } from '../../src/core/run.js';
import { listTemplates, scaffold } from '../../src/index.js';
import {
  memoryReporter,
  readTree,
  scriptedPrompter,
  tempProject,
  writeFiles,
} from '../helpers.js';
import type { Question } from '../../src/core/types.js';

beforeAll(() => {
  process.env.GIT_CONFIG_GLOBAL = path.join(tempProject(), 'none');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  process.env.USERNAME = 'Test User';
  resetUserNameCache();
});

/** A project with one template, `t`, made of the given files. */
function project(files: Record<string, string>, dirs: string[] = []): string {
  const root = tempProject({ dirs: ['out', ...dirs] });
  writeFiles(
    root,
    Object.fromEntries(
      Object.entries(files).map(([f, c]) => [`scaffolding/t/${f}`, c])
    )
  );
  return root;
}

const options = { template: 't', name: 'Tank', destination: 'out' };

describe('unknown variables', () => {
  it('reports $references that do not resolve, in contents and file names', () => {
    const vars = { NAME: 'Tank', ITEMS: [{ name: 'a' }] };
    const { output, unresolved } = renderVelocity(
      [
        '$NAME $TYPO ${ALSO_TYPO} $!SILENT \\$ESCAPED',
        '#if($MAYBE)x#end',
        '#set($x = $UNSET)',
        '#foreach($item in $ITEMS)$item.name $item.nmae#end',
        '#macro(show $v)[$v]#end#show($NAME)',
        'const label = `${count} of ${NAME}`; $AFTER_TICKS',
      ].join('\n'),
      vars
    );
    expect(output).toContain('Tank $TYPO ${ALSO_TYPO}  $ESCAPED');
    // ${count} is inside a JavaScript template literal, so it is meant to be output as is.
    expect(output).toContain('const label = `${count} of Tank`;');
    expect(unresolved).toEqual([
      '$TYPO',
      '${ALSO_TYPO}',
      '$item.nmae',
      '$AFTER_TICKS',
    ]);
  });

  it('warns by default and fails the file with strictVariables', async () => {
    const files = {
      'scaffolding.config.mjs': 'export default {};',
      '${NAME}${SUFFIX}.ts': '$NAME $TYPO',
      'ok.ts': '$NAME',
    };
    const root = project(files);
    const warned = await scaffold({ projectRoot: root, ...options });
    expect(warned.hasErrors).toBe(false);
    expect(warned.files.map(f => [f.path, f.warnings])).toEqual([
      [
        'out/Tank/Tank${SUFFIX}.ts',
        ['unknown variables ${SUFFIX}, $TYPO (escape a literal $ as \\$)'],
      ],
      ['out/Tank/ok.ts', []],
    ]);

    const strict = project({
      ...files,
      'scaffolding.config.mjs': 'export default { strictVariables: true };',
    });
    const failed = await scaffold({ projectRoot: strict, ...options });
    expect(failed.hasErrors).toBe(true);
    expect(failed.files[0]).toMatchObject({
      status: 'error',
      reason: expect.stringMatching(/unknown variables \$\{SUFFIX\}, \$TYPO/),
    });
    expect(existsSync(path.join(strict, 'out/Tank/Tank${SUFFIX}.ts'))).toBe(
      false
    );
    expect(failed.files[1].status).toBe('created');
  });
});

describe('keepLineBreaks', () => {
  it('keeps line breaks after directives that end a line of text', async () => {
    const template = [
      '// #up($NAME)',
      '// list: #foreach($i in [1, 2])$i#if($foreach.hasNext), #end#end',
      'code ## a comment',
      '#if(true)',
      'directive lines are unchanged',
      '#end',
      'last',
      '',
    ].join('\n');
    const files = {
      'scaffolding.config.mjs': `export default {
        keepLineBreaks: true,
        macros: { up: s => s.toUpperCase() },
      };`,
      'a.txt': template,
    };
    const root = project(files);
    const result = await scaffold({ projectRoot: root, ...options });
    expect(result.files[0].content).toBe(
      [
        '// TANK',
        '// list: 1, 2',
        'code ',
        'directive lines are unchanged',
        'last',
        '',
      ].join('\n')
    );

    // Without the option, Velocity's usual behaviour (as in 2.x).
    const compatRoot = project({
      ...files,
      'scaffolding.config.mjs':
        'export default { macros: { up: s => s.toUpperCase() } };',
    });
    const compat = await scaffold({ projectRoot: compatRoot, ...options });
    expect(compat.files[0].content).toBe(
      '// TANK// list: 1, 2code directive lines are unchanged\nlast\n'
    );
  });

  it('leaves directive-only lines and plain text alone', () => {
    expect(keepLineBreak('  #end')).toBe('  #end');
    expect(keepLineBreak('#upperFirst($NAME)')).toBe('#upperFirst($NAME)');
    expect(keepLineBreak('plain (text)')).toBe('plain (text)');
    expect(keepLineBreak('x #up($A)')).toBe('x #up($A)$!{__keepLineBreak}');
  });
});

describe('answers given in advance', () => {
  const q = (question: Partial<Question>): Question =>
    ({ name: 'A', message: 'a', ...question }) as Question;

  it('converts text to the question type', () => {
    expect(priorAnswer(q({ type: 'confirm' }), 'yes')).toBe(true);
    expect(priorAnswer(q({ type: 'confirm' }), 'False')).toBe(false);
    expect(priorAnswer(q({ type: 'number' }), '12')).toBe(12);
    expect(priorAnswer(q({ type: 'words' }), ' a  b ')).toEqual(['a', 'b']);
    expect(priorAnswer(q({ type: 'words', separator: ',' }), 'a b, c')).toEqual(
      ['a b', 'c']
    );
    const choices = [{ value: 'x' }, { value: 'y' }];
    expect(priorAnswer(q({ type: 'checkbox', choices }), 'x, y')).toEqual([
      'x',
      'y',
    ]);
    expect(priorAnswer(q({ type: 'select', choices }), 'y')).toBe('y');
    expect(priorAnswer(q({ type: 'input' }), 'text')).toBe('text');
  });

  it('rejects answers that do not fit the question', () => {
    const choices = [{ value: 'x' }, { value: 'y' }];
    for (const [question, value] of [
      [q({ type: 'confirm' }), 'maybe'],
      [q({ type: 'number' }), 'ten'],
      [q({ type: 'number', min: 1, max: 5 }), '9'],
      [q({ type: 'select', choices }), 'z'],
      [q({ type: 'checkbox', choices }), 'x,z'],
    ] as const) {
      expect(() => priorAnswer(question, value)).toThrow(
        expect.objectContaining({ code: 'INVALID_ANSWER' })
      );
    }
  });
});

describe('hooks', () => {
  it('get the name, answers, builtins, source, destination and dryRun', async () => {
    const root = project({
      'scaffolding.config.mjs': `
        const seen = (globalThis.__seen = {});
        const pick = ctx => ({
          name: ctx.name, answers: ctx.answers, destination: ctx.destination,
          dryRun: ctx.dryRun, hasSource: typeof ctx.source.read === 'function',
          user: ctx.builtins.USERNAME,
        });
        export default {
          prompts: [{ name: 'A', message: 'a' }],
          hooks: {
            beforeRun: ctx => { seen.before = pick(ctx); },
            afterFileCreated: ctx => { seen.file = { ...pick(ctx), path: ctx.path }; },
            afterRun: ctx => { seen.after = { ...pick(ctx), created: ctx.createdPaths }; },
          },
        };`,
      'f.txt': 'x',
    });
    await scaffold({ projectRoot: root, ...options, answers: { A: '1' } });
    const common = {
      name: 'Tank',
      answers: { A: '1' },
      destination: 'out',
      dryRun: false,
      hasSource: true,
      user: 'Test User',
    };
    expect((globalThis as Record<string, unknown>).__seen).toEqual({
      before: common,
      file: { ...common, path: 'out/Tank/f.txt' },
      after: { ...common, created: ['out/Tank/f.txt'] },
    });
  });

  it('errors thrown by beforeRun and afterRun name the hook', async () => {
    for (const hook of ['beforeRun', 'afterRun']) {
      const root = project({
        'scaffolding.config.mjs': `export default { hooks: { ${hook}: () => { throw new Error('nope'); } } };`,
        'f.txt': 'x',
      });
      await expect(
        scaffold({ projectRoot: root, ...options })
      ).rejects.toMatchObject({
        code: 'HOOK_FAILED',
        message: `hooks.${hook}: nope`,
      });
    }
  });
});

describe('destinations', () => {
  const files = {
    'scaffolding.config.mjs':
      "export default { destinations: ['out', 'src/new'] };",
    'f.txt': 'x',
  };

  it('offers to create a missing destination', async () => {
    const root = project(files);
    const deps = {
      projectRoot: root,
      prompter: scriptedPrompter({ createDestination: true }),
      reporter: memoryReporter(),
    };
    await run({ ...options, destination: 'src/new' }, deps);
    expect(deps.prompter.asked[0].message).toBe(
      "'src/new' does not exist. Create it?"
    );
    expect(readTree(path.join(root, 'src/new'))).toEqual({ 'Tank/f.txt': 'x' });

    await expect(
      run(
        { ...options, destination: 'other' },
        { ...deps, prompter: scriptedPrompter({ createDestination: false }) }
      )
    ).rejects.toMatchObject({ code: 'DESTINATION_INVALID' });
  });

  it('does not create it in a dry run, and lists missing destinations as new', async () => {
    const root = project(files);
    const prompter = scriptedPrompter({
      destination: 'src/new',
      createDestination: true,
    });
    await run(
      { template: 't', name: 'Tank', dryRun: true },
      { projectRoot: root, prompter, reporter: memoryReporter() }
    );
    expect(existsSync(path.join(root, 'src/new'))).toBe(false);
    expect(prompter.asked[0]).toMatchObject({
      choices: [
        { value: 'out', name: 'out' },
        { value: 'src/new', name: 'src/new (new)' },
        { name: 'Other' },
      ],
    });
  });

  it('rejects a destination that is a file', async () => {
    const root = project(files);
    writeFiles(root, { 'afile.txt': '' });
    await expect(
      scaffold({ projectRoot: root, ...options, destination: 'afile.txt' })
    ).rejects.toMatchObject({ code: 'DESTINATION_INVALID' });
  });
});

describe('last-run file', () => {
  it('scaffold() saves it only when asked', async () => {
    const root = project({ 'scaffolding.config.mjs': 'export default {};' });
    await scaffold({ projectRoot: root, ...options });
    expect(existsSync(lastRunPath(root))).toBe(false);
    await scaffold({ projectRoot: root, ...options, saveLastRun: true });
    expect(existsSync(lastRunPath(root))).toBe(true);
  });
});

describe('init and listTemplates', () => {
  it('creates a working example template and ignores the last-run file', async () => {
    const root = tempProject();
    rmSync(path.join(root, 'scaffolding'), { recursive: true });
    writeFiles(root, { '.gitignore': 'node_modules' });
    const reporter = memoryReporter();
    const { created, updatedGitignore } = await initScaffolding({
      projectRoot: root,
      dryRun: false,
      reporter,
    });
    expect(created).toEqual([
      'scaffolding/tsconfig.json',
      'scaffolding/_includes/fileHeader.txt',
      'scaffolding/example/scaffolding.config.ts',
      'scaffolding/example/${NAME}.ts',
    ]);
    expect(updatedGitignore).toBe(true);
    expect(readFileSync(path.join(root, '.gitignore'), 'utf-8')).toBe(
      'node_modules\n.template-scaffolder-last-run\n'
    );

    expect(await listTemplates({ projectRoot: root })).toEqual([
      {
        dir: 'example',
        name: 'Example',
        description: 'copy this folder to make your own template',
        version: '1.0',
      },
    ]);

    const result = await scaffold({
      projectRoot: root,
      template: 'example',
      name: 'TankList',
      destination: 'src',
      answers: { createDestination: true },
    });
    expect(result.hasErrors).toBe(false);
    expect(result.files[0].content).toBe(
      [
        '/**',
        ' * Something useful',
        ' *',
        ' * Generated by the Example template for Test User.',
        ' */',
        'export function tankList(): string {',
        "  return 'TankList';",
        '}',
        '',
      ].join('\n')
    );

    await expect(
      initScaffolding({ projectRoot: root, dryRun: false, reporter })
    ).rejects.toMatchObject({ code: 'INIT_REFUSED' });
  });
});
