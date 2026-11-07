/**
 * Shared tree-sitter plumbing for the built-in readers, also usable by custom readers.
 * Grammars are WebAssembly files, so nothing is compiled on install.
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Language, type Node, Parser } from 'web-tree-sitter';

export type { Node } from 'web-tree-sitter';

let init: Promise<void> | undefined;
const languages = new Map<string, Promise<Language>>();

/** Built-in grammars: file name in the package's grammars/ folder, and the npm package it comes from. */
const BUILT_IN_GRAMMARS: Record<string, { file: string; pkg: string }> = {
  typescript: {
    file: 'tree-sitter-typescript.wasm',
    pkg: 'tree-sitter-typescript',
  },
  tsx: { file: 'tree-sitter-tsx.wasm', pkg: 'tree-sitter-typescript' },
  csharp: { file: 'tree-sitter-c_sharp.wasm', pkg: 'tree-sitter-c-sharp' },
  cpp: { file: 'tree-sitter-cpp.wasm', pkg: 'tree-sitter-cpp' },
};

function builtInGrammarPath(id: string): string {
  const g = BUILT_IN_GRAMMARS[id];
  if (!g) throw new Error(`No built-in grammar '${id}'.`);
  // Published package: <root>/grammars/*.wasm (copied at build time).
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const candidate of [
    path.join(here, '../../grammars', g.file),
    path.join(here, '../../../grammars', g.file),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  // Development checkout: straight from the grammar's dev dependency.
  const require = createRequire(import.meta.url);
  return path.join(
    path.dirname(require.resolve(`${g.pkg}/package.json`)),
    g.file
  );
}

/**
 * Load a tree-sitter grammar. Pass a built-in id ('typescript', 'tsx', 'csharp', 'cpp')
 * or the path of any tree-sitter `.wasm` grammar. Loaded once per process.
 */
export async function loadGrammar(idOrWasmPath: string): Promise<Language> {
  init ??= Parser.init();
  await init;
  let lang = languages.get(idOrWasmPath);
  if (!lang) {
    const wasm =
      idOrWasmPath in BUILT_IN_GRAMMARS
        ? builtInGrammarPath(idOrWasmPath)
        : idOrWasmPath;
    lang = Language.load(wasm);
    languages.set(idOrWasmPath, lang);
  }
  return lang;
}

/** Parse text with a grammar and return the root node. */
export async function parse(idOrWasmPath: string, text: string): Promise<Node> {
  const parser = new Parser();
  parser.setLanguage(await loadGrammar(idOrWasmPath));
  const tree = parser.parse(text);
  if (!tree) throw new Error('tree-sitter returned no tree');
  return tree.rootNode;
}

// ---- small helpers for walking trees -------------------------------------------------------

export function field(node: Node, name: string): Node | null {
  return node.childForFieldName(name);
}

export function fieldText(node: Node, name: string): string {
  return node.childForFieldName(name)?.text ?? '';
}

export function namedChildren(node: Node): Node[] {
  return node.namedChildren.filter((c): c is Node => c !== null);
}

export function children(node: Node): Node[] {
  return node.children.filter((c): c is Node => c !== null);
}

export function childrenOfType(node: Node, ...types: string[]): Node[] {
  return namedChildren(node).filter(c => types.includes(c.type));
}

/** True if the node has an anonymous child token with this text, e.g. 'static', '?', 'async'. */
export function hasToken(node: Node, token: string): boolean {
  return children(node).some(c => !c.isNamed && c.type === token);
}

/**
 * Doc comment directly above a declaration: consecutive comment siblings
 * (`/** *\/`, `///`, `//`) with no blank line in between.
 */
export function docComment(node: Node): string | undefined {
  const lines: string[] = [];
  let prev = node.previousSibling;
  let expectedEndRow = node.startPosition.row;
  while (
    prev &&
    prev.type === 'comment' &&
    prev.endPosition.row >= expectedEndRow - 1
  ) {
    lines.unshift(prev.text);
    expectedEndRow = prev.startPosition.row;
    prev = prev.previousSibling;
  }
  if (!lines.length) return undefined;
  return (
    lines
      .join('\n')
      .replace(/^\/\*\*?|\*\/$/g, '')
      .split('\n')
      .map(l => l.replace(/^\s*(\/\/\/?|\*)\s?/, '').trimEnd())
      .join('\n')
      .trim() || undefined
  );
}

/** Body text without the outer braces, de-indented. */
export function blockBody(node: Node | null): string | undefined {
  if (!node) return undefined;
  const text = node.text;
  if (!text.startsWith('{')) return text;
  return text.slice(1, -1).replace(/^\n/, '').trimEnd();
}
