/**
 * A language-neutral model of the declarations in a source file.
 * Every reader (TypeScript, C#, C++, or custom) produces this shape,
 * so template helpers work the same way whatever language they read.
 *
 * Types are kept as source text (`'List<Order>'`, `'Foo | undefined'`, `'std::vector<int>'`).
 * `text`, `bodyText` and `raw` are escape hatches for details the model does not capture.
 */

export type TypeKind =
  'interface' | 'class' | 'struct' | 'enum' | 'record' | 'alias' | 'union';

export type Access = 'public' | 'protected' | 'private' | 'internal';

export interface IParamDecl {
  name: string;
  /** Source text of the type, or '' when the source has none (e.g. plain JS). */
  type: string;
  optional: boolean;
  /** Source text of the default value, if any. */
  default?: string;
}

export interface IFieldDecl {
  name: string;
  type: string;
  optional: boolean;
  static: boolean;
  readonly: boolean;
  access?: Access;
  attributes: string[];
  doc?: string;
}

export interface IFunctionDecl {
  name: string;
  params: IParamDecl[];
  /** Source text of the return type, or '' if not declared. */
  returnType: string;
  async: boolean;
  static: boolean;
  access?: Access;
  attributes: string[];
  doc?: string;
  /** Source text of the body, without the surrounding braces' indentation trimmed. */
  bodyText?: string;
  /** Full source text of the declaration. */
  text: string;
  /** The reader's native node (a tree-sitter `Node` for built-in readers). */
  raw?: unknown;
}

export interface IEnumMember {
  name: string;
  /** Source text of the initializer, if any. */
  value?: string;
}

export interface ITypeDecl {
  name: string;
  kind: TypeKind;
  /** Dotted namespace (C#) or `::`-joined namespace (C++); TypeScript `namespace` blocks too. */
  namespace?: string;
  exported: boolean;
  /** Base classes and implemented interfaces, as source text. */
  bases: string[];
  /** Generic / template parameters, as source text. */
  typeParams: string[];
  /** Fields and properties (C# properties and TS property signatures are fields). */
  fields: IFieldDecl[];
  methods: IFunctionDecl[];
  /** Enum members (only for kind 'enum'). */
  members: IEnumMember[];
  /** Right-hand side of a type alias, as source text (only for kind 'alias' / 'union'). */
  aliasOf?: string;
  attributes: string[];
  doc?: string;
  text: string;
  raw?: unknown;
}

export interface ISourceFile {
  /** Path as given to the reader, forward slashes. */
  path: string;
  /** Reader id, e.g. 'typescript', 'csharp', 'cpp'. */
  language: string;
  text: string;
  types: ITypeDecl[];
  /** Top-level / free functions. */
  functions: IFunctionDecl[];
  namespaces: string[];
  /** True if the parser reported syntax errors (the model is still best-effort filled). */
  hasErrors: boolean;

  /** Find a type by name; throws a clear error naming the file if missing. */
  type(name: string): ITypeDecl;
  /** Like `type()` but only matches kind 'enum'. */
  enum(name: string): ITypeDecl;
  /** Matches classes, structs and records. */
  class(name: string): ITypeDecl;
  /** Matches interfaces. */
  interface(name: string): ITypeDecl;
  /** Find a type by name without throwing. */
  findType(name: string): ITypeDecl | undefined;
  /** All types matching a predicate. */
  findTypes(predicate: (t: ITypeDecl) => boolean): ITypeDecl[];
}

/** The data a reader produces; query helpers are added by the framework. */
export type SourceFileData = Omit<
  ISourceFile,
  'type' | 'enum' | 'class' | 'interface' | 'findType' | 'findTypes'
>;

export interface ISourceReader {
  /** Unique id, e.g. 'csharp'. Used with `read(path, { reader })`. */
  id: string;
  /** File extensions this reader handles, with the dot, e.g. ['.cs']. */
  extensions: string[];
  read(file: { path: string; text: string }): Promise<SourceFileData>;
}

export interface IReadOptions {
  /** Force a reader by id instead of choosing by file extension. */
  reader?: string;
}

/** Available as `ctx.source` in config functions. */
export interface ISourceApi {
  /** Parse one file. Paths are relative to the project root. Results are cached per run. */
  read(path: string, options?: IReadOptions): Promise<ISourceFile>;
  /** Parse every file matching a glob (relative to the project root). */
  readAll(pattern: string, options?: IReadOptions): Promise<ISourceFile[]>;
  /** Ids and extensions of the registered readers. */
  readers(): Array<{ id: string; extensions: string[] }>;
}
