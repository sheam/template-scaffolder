import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import picomatch from 'picomatch';
import { errorMessage, ScaffolderError } from '../core/errors.js';
import type {
  IFunctionDecl,
  IReadOptions,
  ISourceApi,
  ISourceFile,
  ISourceReader,
  ITypeDecl,
  SourceFileData,
} from './types.js';

/** Identity helper that type-checks a custom reader. */
export function defineSourceReader(reader: ISourceReader): ISourceReader {
  return reader;
}

/** Built-in readers. Each implementation (and its grammar) is loaded on first use. */
function lazyReader(
  id: string,
  extensions: string[],
  load: () => Promise<{ default: ISourceReader }>
): ISourceReader {
  let impl: Promise<ISourceReader> | undefined;
  return {
    id,
    extensions,
    async read(file) {
      impl ??= load().then(m => m.default);
      return (await impl).read(file);
    },
  };
}

export const BUILT_IN_READERS: readonly ISourceReader[] = [
  lazyReader(
    'typescript',
    ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
    () => import('./readers/typescript.js')
  ),
  lazyReader('csharp', ['.cs'], () => import('./readers/csharp.js')),
  lazyReader(
    'cpp',
    ['.h', '.hpp', '.hh', '.hxx', '.cpp', '.cc', '.cxx', '.c++', '.ipp'],
    () => import('./readers/cpp.js')
  ),
];

/** Add query helpers to a reader's result. */
export function withQueries(data: SourceFileData): ISourceFile {
  const findType = (name: string): ITypeDecl | undefined =>
    data.types.find(t => t.name === name);
  const get = (
    name: string,
    kinds: ITypeDecl['kind'][] | null,
    label: string
  ): ITypeDecl => {
    const found = data.types.find(
      t => t.name === name && (!kinds || kinds.includes(t.kind))
    );
    if (found) return found;
    const available = data.types
      .filter(t => !kinds || kinds.includes(t.kind))
      .map(t => t.name);
    throw new ScaffolderError(
      'SOURCE_READ_FAILED',
      `No ${label} named '${name}' in ${data.path}. Found: ${available.join(', ') || 'none'}.`
    );
  };
  return {
    ...data,
    findType,
    findTypes: predicate => data.types.filter(predicate),
    type: name => get(name, null, 'type'),
    enum: name => get(name, ['enum'], 'enum'),
    class: name =>
      get(name, ['class', 'struct', 'record'], 'class, struct or record'),
    interface: name => get(name, ['interface'], 'interface'),
  };
}

class SourceRegistry implements ISourceApi {
  private custom: ISourceReader[] = [];
  private cache = new Map<string, Promise<ISourceFile>>();
  projectRoot = process.cwd();

  register(reader: ISourceReader): void {
    this.custom = [reader, ...this.custom.filter(r => r.id !== reader.id)];
  }

  /** Custom readers take precedence over built-ins for the same extension or id. */
  private all(): ISourceReader[] {
    const customIds = new Set(this.custom.map(r => r.id));
    return [
      ...this.custom,
      ...BUILT_IN_READERS.filter(r => !customIds.has(r.id)),
    ];
  }

  readers(): Array<{ id: string; extensions: string[] }> {
    return this.all().map(r => ({ id: r.id, extensions: [...r.extensions] }));
  }

  private pick(filePath: string, options?: IReadOptions): ISourceReader {
    const readers = this.all();
    if (options?.reader) {
      const byId = readers.find(r => r.id === options.reader);
      if (!byId) {
        throw new ScaffolderError(
          'SOURCE_READ_FAILED',
          `No source reader with id '${options.reader}'. Registered: ${readers.map(r => r.id).join(', ')}.`
        );
      }
      return byId;
    }
    const lower = filePath.toLowerCase();
    const match = readers
      .flatMap(r => r.extensions.map(ext => ({ r, ext: ext.toLowerCase() })))
      .filter(x => lower.endsWith(x.ext))
      .sort((a, b) => b.ext.length - a.ext.length)[0];
    if (!match) {
      throw new ScaffolderError(
        'SOURCE_READ_FAILED',
        `No source reader for '${filePath}'. Pass { reader: '<id>' } or register one in the config's 'readers'.`
      );
    }
    return match.r;
  }

  async read(filePath: string, options?: IReadOptions): Promise<ISourceFile> {
    const absolute = path.resolve(this.projectRoot, filePath);
    const reader = this.pick(filePath, options);
    const key = `${reader.id}:${absolute}`;
    let entry = this.cache.get(key);
    if (!entry) {
      entry = (async () => {
        let text: string;
        try {
          text = await readFile(absolute, 'utf-8');
        } catch (e) {
          throw new ScaffolderError(
            'SOURCE_READ_FAILED',
            `Cannot read source file ${filePath}: ${errorMessage(e)}`,
            { cause: e }
          );
        }
        const data = await reader.read({
          path: filePath.replaceAll('\\', '/'),
          text,
        });
        return withQueries(data);
      })();
      this.cache.set(key, entry);
      entry.catch(() => this.cache.delete(key));
    }
    return entry;
  }

  async readAll(
    pattern: string,
    options?: IReadOptions
  ): Promise<ISourceFile[]> {
    const files = await globFiles(this.projectRoot, pattern);
    return Promise.all(files.map(f => this.read(f, options)));
  }

  /** Start of a run: new project root, no stale parses. */
  reset(projectRoot: string): void {
    this.projectRoot = projectRoot;
    this.cache.clear();
  }
}

/**
 * One registry per process, shared by `ctx.source` and the standalone functions.
 * Kept on globalThis because config files load their own copy of this module
 * (through the config loader); every copy must see the same project root, readers and cache.
 */
const REGISTRY_KEY = Symbol.for('template-scaffolder.sourceRegistry');
export const sourceRegistry: SourceRegistry = ((
  globalThis as Record<symbol, SourceRegistry | undefined>
)[REGISTRY_KEY] ??= new SourceRegistry());

/** Parse one file. Paths are relative to the project root (the working directory by default). */
export function readSource(
  filePath: string,
  options?: IReadOptions
): Promise<ISourceFile> {
  return sourceRegistry.read(filePath, options);
}

/** Parse every file matching a glob such as 'src/**\/*.cs'. */
export function readSources(
  pattern: string,
  options?: IReadOptions
): Promise<ISourceFile[]> {
  return sourceRegistry.readAll(pattern, options);
}

/** Make a custom reader available to `readSource` and `ctx.source`. */
export function registerSourceReader(reader: ISourceReader): void {
  sourceRegistry.register(reader);
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'bin', 'obj', 'dist']);

async function globFiles(root: string, pattern: string): Promise<string[]> {
  const posixPattern = pattern.replaceAll('\\', '/');
  const { base } = picomatch.scan(posixPattern);
  const isMatch = picomatch(posixPattern, { dot: false });
  const start = path.resolve(root, base || '.');
  let entries;
  try {
    entries = await readdir(start, { recursive: true, withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter(e => e.isFile())
    .map(e =>
      path.relative(root, path.join(e.parentPath, e.name)).replaceAll('\\', '/')
    )
    .filter(rel => !rel.split('/').some(part => SKIP_DIRS.has(part)))
    .filter(rel => isMatch(rel))
    .sort();
}

/**
 * Check that a reader's output matches the model, for authors of custom readers:
 * `expect(await checkSourceReader(myReader, { path: 'x.proto', text })).toEqual([])`.
 * Returns a list of problems (empty when the output is valid).
 */
export async function checkSourceReader(
  reader: ISourceReader,
  sample: { path: string; text: string }
): Promise<string[]> {
  const problems: string[] = [];
  const need = (cond: boolean, msg: string): void => {
    if (!cond) problems.push(msg);
  };
  need(
    typeof reader.id === 'string' && reader.id.length > 0,
    'reader.id must be a non-empty string'
  );
  need(
    Array.isArray(reader.extensions) &&
      reader.extensions.every(e => e.startsWith('.')),
    'reader.extensions must be strings starting with "."'
  );
  const data = await reader.read(sample);
  need(data.path === sample.path, 'path must be the path given to read()');
  need(data.language === reader.id, 'language must equal reader.id');
  need(Array.isArray(data.types), 'types must be an array');
  need(Array.isArray(data.functions), 'functions must be an array');
  need(Array.isArray(data.namespaces), 'namespaces must be an array');
  const fn = (f: IFunctionDecl, where: string): void => {
    need(typeof f.name === 'string', `${where}: name must be a string`);
    need(Array.isArray(f.params), `${where}: params must be an array`);
    need(
      typeof f.returnType === 'string',
      `${where}: returnType must be a string`
    );
    need(Array.isArray(f.attributes), `${where}: attributes must be an array`);
    need(typeof f.text === 'string', `${where}: text must be a string`);
  };
  for (const t of data.types ?? []) {
    const where = `type ${t.name}`;
    need(
      typeof t.name === 'string' && t.name.length > 0,
      'every type needs a name'
    );
    for (const key of [
      'bases',
      'typeParams',
      'fields',
      'methods',
      'members',
      'attributes',
    ] as const) {
      need(Array.isArray(t[key]), `${where}: ${key} must be an array`);
    }
    t.fields?.forEach(f =>
      need(
        typeof f.name === 'string' && typeof f.type === 'string',
        `${where}: fields need name and type strings`
      )
    );
    t.methods?.forEach(m => fn(m, `${where}.${m.name}`));
  }
  data.functions?.forEach(f => fn(f, `function ${f.name}`));
  return problems;
}
