// Runs the built CLI as a subprocess. Skipped unless `npm run build` has been run.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, tempProject, writeFiles } from '../helpers.js';

const BIN = path.join(REPO_ROOT, 'dist/cli/main.js');

function cli(
  args: string[],
  cwd = REPO_ROOT
): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  return { status: r.status, out: r.stdout + r.stderr };
}

describe.skipIf(!existsSync(BIN))('CLI', () => {
  it('prints help and version', () => {
    expect(cli(['--help']).out).toMatch(/scaffolder migrate/);
    const pkg = JSON.parse(
      readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8')
    );
    expect(cli(['--version']).out.trim()).toBe(pkg.version);
  });

  it('exits 2 for bad arguments', () => {
    const r = cli(['--bogus']);
    expect(r.status).toBe(2);
    expect(r.out).toMatch(/--help/);
  });

  it('--workDir resolves scaffolding, destination and last-run file inside that directory', () => {
    const project = tempProject({ dirs: ['out'] });
    const elsewhere = tempProject();
    const r = cli(
      [
        '--workDir',
        project,
        '--template',
        'typescript-component',
        '--name',
        'W',
        'out',
      ],
      elsewhere
    );
    expect(r.out).toMatch(/created\s+out\/W\/Output.ts/);
    expect(r.status).toBe(0);
    expect(existsSync(path.join(project, 'out/W/Output.ts'))).toBe(true);
    expect(
      existsSync(path.join(project, '.template-scaffolder-last-run'))
    ).toBe(true);
    expect(
      existsSync(path.join(elsewhere, '.template-scaffolder-last-run'))
    ).toBe(false);
  });

  it('exits 1 with a clear message when there is no scaffolding folder', () => {
    const r = cli(['--template', 'x'], path.join(REPO_ROOT, 'test'));
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/No 'scaffolding' folder/);
  });

  it('init, list and --answer work together without prompts', () => {
    const project = tempProject();
    rmSync(path.join(project, 'scaffolding'), { recursive: true });
    expect(cli(['init'], project)).toMatchObject({ status: 0 });

    const list = cli(['list', '--json'], project);
    expect(JSON.parse(list.out)).toEqual([
      expect.objectContaining({ dir: 'example', name: 'Example' }),
    ]);

    const r = cli(
      [
        '--template=example',
        '--name=TankList',
        '--answer',
        'DESCRIPTION=Lists tanks',
        '--answer',
        'createDestination=yes',
        'src',
      ],
      project
    );
    expect(r.out).toMatch(/created\s+src\/TankList\/TankList.ts/);
    expect(r.status).toBe(0);
    expect(
      readFileSync(path.join(project, 'src/TankList/TankList.ts'), 'utf-8')
    ).toMatch(/Lists tanks/);
  });

  it('names the hook that failed, with a stack trace under --debug', () => {
    const project = tempProject({ dirs: ['out'] });
    writeFiles(project, {
      'scaffolding/bad/scaffolding.config.mjs':
        "export default { hooks: { beforeRun: () => { throw new Error('route must start with /'); } } };",
    });
    const args = ['--template=bad', '--name=X', 'out'];
    const plain = cli(args, project);
    expect(plain.status).toBe(1);
    expect(plain.out.trim()).toBe('hooks.beforeRun: route must start with /');
    const debug = cli([...args, '--debug'], project);
    expect(debug.out).toMatch(
      /Caused by: Error: route must start with \/\n\s+at /
    );
  });
});
