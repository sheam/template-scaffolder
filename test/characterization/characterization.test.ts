// Compares the generated file tree of the built CLI against golden output captured from v2.3.12.
// Run with `npm run test:characterization` (builds first). Intentional differences are
// made by recapturing: `node test/characterization/harness.mjs --capture`, then reviewing the git diff.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS harness shared with the capture script
import { CASES, goldenPath, REPO_ROOT, runCase } from './harness.mjs';

type Case = { id: string };
const built = existsSync(path.join(REPO_ROOT, 'dist'));

describe.skipIf(!built)(
  'characterization (built CLI vs v2.3.12 golden output)',
  () => {
    for (const testCase of CASES as Case[]) {
      it(testCase.id, () => {
        const result = runCase(testCase);
        expect(result.status, result.stderr).toBe(0);
        expect(`${result.files}\n`).toEqual(
          readFileSync(goldenPath(testCase), 'utf-8')
        );
      });
    }
  }
);
