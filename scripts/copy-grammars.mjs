// Copies the tree-sitter grammars used by the built-in source readers into grammars/,
// which is published with the package. The grammar packages are dev dependencies only.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const grammars = [
  ['tree-sitter-typescript', 'tree-sitter-typescript.wasm'],
  ['tree-sitter-typescript', 'tree-sitter-tsx.wasm'],
  ['tree-sitter-c-sharp', 'tree-sitter-c_sharp.wasm'],
  ['tree-sitter-cpp', 'tree-sitter-cpp.wasm'],
];
mkdirSync(path.join(root, 'grammars'), { recursive: true });
for (const [pkg, file] of grammars) {
  const from = path.join(
    path.dirname(require.resolve(`${pkg}/package.json`)),
    file
  );
  copyFileSync(from, path.join(root, 'grammars', file));
}
console.log(`copied ${grammars.length} grammars to grammars/`);
