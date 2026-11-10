// Characterization harness: runs the *built* CLI as a subprocess against a temp copy
// of the in-repo fixtures, using a crafted last-run file so no prompts are needed.
// Golden output (the generated file tree) was captured from v2.3.12 before the v3 rewrite began.
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

export const CASES = [
  {
    id: 'component',
    name: 'MyWidget',
    destination: 'out/components',
    promptResults: [{ name: 'SOME_VAL', answer: 'Three' }],
  },
  {
    id: 'conversion',
    name: 'Converted',
    destination: './out',
    promptResults: [{ name: 'PromptedType', answer: 'Date' }],
  },
  {
    id: 'typescript-component',
    name: 'Simple',
    destination: 'out/testdir/subdir1',
    promptResults: [],
  },
];

function binPath() {
  const pkg = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8')
  );
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.scaffolder;
  return path.join(REPO_ROOT, bin);
}

export function makeProject(testCase) {
  const dir = mkdtempSync(
    path.join(os.tmpdir(), `scaffolder-char-${testCase.id}-`)
  );
  cpSync(path.join(REPO_ROOT, 'scaffolding'), path.join(dir, 'scaffolding'), {
    recursive: true,
  });
  mkdirSync(path.join(dir, testCase.destination), { recursive: true });
  // Fixtures import 'template-scaffolder'; the loader aliases it to the running copy, and the
  // node_modules link below covers anything else that resolves the package by name.
  mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
  symlinkSync(
    REPO_ROOT,
    path.join(dir, 'node_modules', 'template-scaffolder'),
    'junction'
  );
  const lastRun = {
    lastRunConfigFormatVersion: '1.0',
    name: testCase.name,
    args: { template: testCase.id },
    destination: testCase.destination,
    promptResults: testCase.promptResults,
  };
  writeFileSync(
    path.join(dir, '.template-scaffolder-last-run'),
    JSON.stringify(lastRun, null, 2)
  );
  const gitConfig = path.join(dir, '.gitconfig-test');
  writeFileSync(gitConfig, '[user]\n\tname = Test User\n');
  return { dir, gitConfig };
}

export function normalize(text, dir) {
  return text
    .replaceAll(dir, '<PROJECT>')
    .replaceAll(os.homedir(), '<HOME>')
    .replaceAll('\\', '/')
    .trim();
}

function snapshotTree(root, rel = '') {
  const out = [];
  const abs = path.join(root, rel);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs).sort()) {
    const r = rel ? `${rel}/${entry}` : entry;
    if (statSync(path.join(root, r)).isDirectory())
      out.push(...snapshotTree(root, r));
    else out.push(`===== ${r}\n${readFileSync(path.join(root, r), 'utf-8')}`);
  }
  return out;
}

/** Runs the built CLI for real (not dry-run) and returns every file written under the destination. */
export function runCase(testCase) {
  const { dir, gitConfig } = makeProject(testCase);
  const res = spawnSync(process.execPath, [binPath(), '--rerun'], {
    cwd: dir,
    encoding: 'utf-8',
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: gitConfig,
      GIT_CONFIG_NOSYSTEM: '1',
      DEBUG: '',
    },
  });
  const files = normalize(
    snapshotTree(path.join(dir, testCase.destination)).join('\n'),
    dir
  );
  return {
    status: res.status,
    files,
    stdout: res.stdout,
    stderr: res.stderr,
    dir,
  };
}

export function goldenPath(testCase) {
  return path.join(
    REPO_ROOT,
    'test/characterization/__golden__',
    `${testCase.id}.txt`
  );
}

// `node test/characterization/harness.mjs --capture` writes golden files from the current build.
if (
  process.argv[1] === fileURLToPath(import.meta.url) &&
  process.argv.includes('--capture')
) {
  mkdirSync(path.join(REPO_ROOT, 'test/characterization/__golden__'), {
    recursive: true,
  });
  for (const c of CASES) {
    const r = runCase(c);
    writeFileSync(goldenPath(c), `${r.files}\n`);
    console.log(
      `${c.id}: exit ${r.status}, ${r.files.split('\n').length} lines${r.status ? `\nSTDERR:\n${r.stderr}` : ''}`
    );
  }
}
