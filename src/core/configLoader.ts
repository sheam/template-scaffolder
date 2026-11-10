import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { errorMessage, ScaffolderError } from './errors.js';

/** Loads a config file and returns its default export. */
export interface IConfigLoader {
  load(absolutePath: string): Promise<unknown>;
}

/**
 * The package entry point of the running scaffolder. Config files that import
 * 'template-scaffolder' get this copy, so they work under `npx` without a local install
 * and always match the running version.
 */
function selfEntry(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, '../index.js'),
    path.join(here, '../index.ts'),
  ];
  return candidates.find(c => existsSync(c)) ?? candidates[0];
}

/**
 * Loads `.ts/.mts/.cts/.js/.mjs/.cjs` configs (and anything they import) with jiti.
 * No compile cache folder in the project; TypeScript and ESM/CJS interop are handled in memory.
 */
export function createConfigLoader(): IConfigLoader {
  const entry = selfEntry();
  const sourceDir = path.dirname(fileURLToPath(import.meta.url));
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    moduleCache: false,
    fsCache: false,
    alias: {
      'template-scaffolder/source': path.join(sourceDir, '../source/index'),
      // 2.x configs imported types from this deep path
      'template-scaffolder/dist/types': entry,
      'template-scaffolder': entry,
    },
  });
  return {
    async load(absolutePath) {
      try {
        return await jiti.import(absolutePath, { default: true });
      } catch (e) {
        throw new ScaffolderError(
          'CONFIG_LOAD_FAILED',
          `Failed to load ${absolutePath}: ${errorMessage(e)}`,
          { cause: e }
        );
      }
    },
  };
}
