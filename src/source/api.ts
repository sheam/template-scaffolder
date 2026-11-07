import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import picomatch from 'picomatch';
import { errorMessage, ScaffolderError } from '../core/errors.js';
import type {
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

  read(filePath: string, options?: IReadOptions): Promise<ISourceFile> {
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

/** One registry per process, shared by `ctx.source` and the standalone functions. */
export const sourceRegistry = new SourceRegistry();

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
