import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';


const src = (p: string): string =>
  fileURLToPath(new URL(`./src/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    // docs/examples import the package by name; point them at the source.
    alias: [
      {
        find: /^template-scaffolder\/source$/,
        replacement: src('source/index.ts'),
      },
      { find: /^template-scaffolder$/, replacement: src('index.ts') },
    ],
  },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
