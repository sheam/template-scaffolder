// Migrates the saved 2.x fixtures, then checks v3 generates what 2.3.12 generated.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { resetUserNameCache } from '../../src/core/builtIns.js';
import { run } from '../../src/core/run.js';
import { runMigrate } from '../../src/migrate/index.js';
// @ts-expect-error plain JS harness shared with the capture script
import { CASES, goldenPath } from '../characterization/harness.mjs';
import {
  memoryReporter,
  readTree,
  REPO_ROOT,
  scriptedPrompter,
  tempProject,
} from '../helpers.js';

type Case = {
  id: string;
  name: string;
  destination: string;
  promptResults: Array<{ name: string; answer: unknown }>;
};

let project: string;
const reporter = memoryReporter();

beforeAll(async () => {
  project = tempProject({
    scaffolding: path.join(REPO_ROOT, 'test/fixtures/v2/scaffolding'),
  });
  const result = await runMigrate({
    projectRoot: project,
    dir: 'scaffolding',
    dryRun: false,
    force: true,
    reporter,
  });
  expect(result.problems).toEqual([]);
  expect(result.changedFiles).toHaveLength(3);
  const gitConfig = path.join(project, '.gitconfig-test');
  writeFileSync(gitConfig, '[user]\n\tname = Test User\n');
  process.env.GIT_CONFIG_GLOBAL = gitConfig;
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  resetUserNameCache();
});

describe('migrated 2.x fixtures', () => {
  for (const c of CASES as Case[]) {
    it(`${c.id} generates the same files as 2.3.12`, async () => {
      const dir = tempProject({
        scaffolding: path.join(project, 'scaffolding'),
      });
      mkdirSync(path.join(dir, c.destination), { recursive: true });
      cpSync(
        path.join(project, '.gitconfig-test'),
        path.join(dir, '.gitconfig-test')
      );
      const answers = Object.fromEntries(
        c.promptResults.map(r => [r.name, r.answer])
      );
      await run(
        { template: c.id, name: c.name, destination: c.destination },
        {
          projectRoot: dir,
          prompter: scriptedPrompter(answers),
          reporter: memoryReporter(),
        }
      );
      const tree = readTree(path.join(dir, c.destination));
      const actual = Object.entries(tree)
        .map(([f, content]) => `===== ${f}\n${content}`)
        .join('\n')
        .replaceAll(dir, '<PROJECT>')
        .replaceAll(homedir(), '<HOME>')
        .trim();
      // The golden output already excludes conversion/helpers.js: both the in-repo fixture
      // and the converter add ignore: ['helpers.js'] (2.x copied it into the output).
      const golden = readFileSync(goldenPath(c), 'utf-8').trim();
      expect(actual).toBe(golden);
    });
  }
});
