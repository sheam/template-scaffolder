import { describe, expect, it } from 'vitest';
import { parseCli } from '../../src/cli/args.js';
import { mapConcurrent } from '../../src/core/concurrency.js';
import { normalizeConfig } from '../../src/core/config.js';
import { parseLastRun } from '../../src/core/lastRun.js';
import { resolveOptions } from '../../src/core/options.js';
import { validateQuestions } from '../../src/core/questions.js';

describe('resolveOptions precedence', () => {
  const lastRun = {
    template: 'last',
    name: 'LastName',
    destination: 'last/dir',
    dryRun: true,
    overwrite: true,
    parallel: true,
    answers: { A: 1, B: 2 },
  };

  it('uses the last run when nothing is given', () => {
    expect(resolveOptions({}, lastRun)).toEqual({
      template: 'last',
      name: 'LastName',
      destination: 'last/dir',
      dryRun: true,
      overwrite: true,
      parallel: true,
      answers: { A: 1, B: 2 },
    });
  });

  it('lets explicit options and answers win over the last run', () => {
    const r = resolveOptions(
      { name: 'New', dryRun: false, answers: { B: 3 } },
      lastRun
    );
    expect(r.name).toBe('New');
    expect(r.template).toBe('last');
    expect(r.dryRun).toBe(false);
    expect(r.answers).toEqual({ A: 1, B: 3 });
  });

  it('defaults booleans to false without a last run', () => {
    expect(resolveOptions({}, null)).toMatchObject({
      dryRun: false,
      overwrite: false,
      parallel: false,
      answers: {},
    });
  });
});

describe('parseLastRun', () => {
  it('upgrades the 1.0 format and drops the destination prompt result', () => {
    expect(
      parseLastRun({
        lastRunConfigFormatVersion: '1.0',
        name: 'N',
        destination: 'd',
        args: { template: 't', parallel: true },
        promptResults: [
          { name: 'X', answer: false },
          { name: 'destination', answer: 'd' },
        ],
      })
    ).toEqual({
      template: 't',
      name: 'N',
      destination: 'd',
      dryRun: false,
      overwrite: false,
      parallel: true,
      answers: { X: false },
    });
  });

  it('rejects unknown versions', () => {
    expect(() => parseLastRun({ lastRunConfigFormatVersion: '9' })).toThrow(
      /unknown format version/
    );
  });
});

describe('normalizeConfig', () => {
  it('fills defaults', async () => {
    const { config, warnings } = normalizeConfig({}, 'dir');
    expect(config.name).toBe('dir');
    expect(config.version).toBe('1.0');
    expect(config.createNameDir).toBe(true);
    expect(await config.variables({} as never)).toEqual({});
    expect(warnings).toEqual([]);
  });

  it('maps 2.x destinations string to destination with a warning', () => {
    const { config, warnings } = normalizeConfig(
      { destinations: './src' },
      'dir'
    );
    expect(config.destination).toBe('./src');
    expect(warnings[0]).toMatch(/destinations.*deprecated/);
  });

  it('warns about unknown keys and collects all errors', () => {
    expect(() =>
      normalizeConfig(
        { createNameDir: 'yes', stripLines: [1], hooks: { nope: () => 1 } },
        'dir'
      )
    ).toThrow(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.stringMatching(/createNameDir/),
          expect.stringMatching(/stripLines/),
          expect.stringMatching(/hooks.nope/),
        ]),
      })
    );
    expect(normalizeConfig({ colour: 'red' }, 'dir').warnings[0]).toMatch(
      /unknown config key 'colour'/
    );
  });

  it('wraps errors thrown by config functions with the template name', async () => {
    const { config } = normalizeConfig(
      {
        name: 'T',
        variables: () => {
          throw new Error('bad');
        },
      },
      'dir'
    );
    await expect(config.variables({} as never)).rejects.toThrow(
      /'variables' in template 'T' threw: bad/
    );
  });
});

describe('validateQuestions', () => {
  it('maps legacy types and maxDepth with warnings, without mutating input', () => {
    const input = [
      { name: 'A', type: 'list', message: 'a', choices: [] },
      { name: 'B', type: 'fuzzypath', message: 'b', maxDepth: 2 },
    ];
    const { questions, warnings } = validateQuestions(input, 't');
    expect(questions.map(q => q.type)).toEqual(['select', 'path']);
    expect(questions[1]).toMatchObject({ depthLimit: 2 });
    expect(input[0].type).toBe('list');
    expect(warnings).toHaveLength(3);
  });

  it('defaults the type to input and rejects duplicate names', () => {
    expect(
      validateQuestions([{ name: 'A', message: 'a' }], 't').questions[0].type
    ).toBe('input');
    expect(() =>
      validateQuestions(
        [
          { name: 'A', message: 'a' },
          { name: 'A', message: 'b' },
        ],
        't'
      )
    ).toThrow(/Invalid prompts/);
  });
});

describe('parseCli', () => {
  it('parses scaffold options and the positional destination', () => {
    expect(
      parseCli(['src/x', '--template', 't', '--dryRun', '--parallel'])
    ).toMatchObject({
      command: 'scaffold',
      destination: 'src/x',
      template: 't',
      dryRun: true,
      parallel: true,
    });
  });

  it('accepts 2.x --flag=true forms and kebab-case', () => {
    expect(
      parseCli(['--dryRun=true', '--overwrite=false', '--work-dir', 'w'])
    ).toMatchObject({
      dryRun: true,
      overwrite: undefined,
      workDir: 'w',
    });
  });

  it('parses migrate', () => {
    expect(parseCli(['migrate', '--dryRun'])).toMatchObject({
      command: 'migrate',
      dir: 'scaffolding',
      dryRun: true,
      force: false,
    });
  });

  it('rejects unknown flags with INVALID_ARGS', () => {
    expect(() => parseCli(['--nope'])).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGS' })
    );
  });

  it('parses --answer and --answers', () => {
    expect(
      parseCli([
        '--answer',
        'STYLE=css',
        '--answer',
        'TITLE=a=b',
        '--answers',
        'a.json',
      ])
    ).toMatchObject({
      answers: { STYLE: 'css', TITLE: 'a=b' },
      answersFile: 'a.json',
    });
    expect(() => parseCli(['--answer', 'STYLE'])).toThrow(/KEY=value/);
  });

  it('parses init and list', () => {
    expect(parseCli(['init', '--dry-run'])).toMatchObject({
      command: 'init',
      dryRun: true,
    });
    expect(parseCli(['list', '--json', '--workDir', 'w'])).toMatchObject({
      command: 'list',
      json: true,
      workDir: 'w',
    });
  });

  it('rejects options that do not apply to the command', () => {
    expect(() => parseCli(['list', '--overwrite'])).toThrow(
      '--overwrite does not apply to `scaffolder list`.'
    );
    expect(() => parseCli(['--force'])).toThrow(
      '--force does not apply to generating files.'
    );
    expect(() => parseCli(['init', 'extra'])).toThrow(/Unexpected arguments/);
  });
});

describe('mapConcurrent', () => {
  it('keeps input order and respects the limit', async () => {
    let active = 0;
    let peak = 0;
    const result = await mapConcurrent(
      [30, 10, 20, 5],
      async ms => {
        active++;
        peak = Math.max(peak, active);
        await new Promise(r => setTimeout(r, ms));
        active--;
        return ms;
      },
      { parallel: true, limit: 2 }
    );
    expect(result).toEqual([30, 10, 20, 5]);
    expect(peak).toBe(2);
  });
});
