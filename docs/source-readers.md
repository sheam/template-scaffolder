[Docs](README.md) › Reading source code

# Reading source code

Templates often need facts about code that already exists: the methods of an API
client, the members of an enum, the fields of a DTO, the actions of a controller.
Source readers parse a file and return its declarations in one model, whatever the
language, so a config can use them instead of regular expressions.

## Using them

In a config function, use `source` from the context:

```ts
export default defineConfig<{ ENDPOINT_PATH: string }>({
  prompts: async ({ source }) => [
    {
      name: 'ROLE',
      type: 'select',
      message: 'Role:',
      choices: (await source.read('src/enums.ts'))
        .enum('BusinessRoles')
        .members.map(m => ({ value: m.name })),
    },
  ],
  variables: async ({ answers, source }) => {
    const file = await source.read(answers.ENDPOINT_PATH);
    return { CLIENT: file.findTypes(t => t.name.endsWith('ApiClient'))[0] };
  },
});
```

In helper files, import the same functions:

```ts
import { readSource, readSources, tsTypes } from 'template-scaffolder/source';

const dtos = await readSources('src/Api/**/*Dto.cs');
```

| Context (`source.`) | Helper import | Does                                             |
| ------------------- | ------------- | ------------------------------------------------ |
| `read(path, opts?)` | `readSource`  | Parse one file.                                  |
| `readAll(glob)`     | `readSources` | Parse every matching file, sorted by path.       |
| `readers()`         | (none)        | List the registered readers' ids and extensions. |

Paths and globs are relative to the project root. Each file is parsed once per run,
however many times it is read. Globs skip `node_modules`, `.git`, `bin`, `obj` and
`dist`.

## Built-in readers

| Reader id    | Extensions                                 |
| ------------ | ------------------------------------------ |
| `typescript` | `.ts .tsx .mts .cts .js .jsx .mjs .cjs`    |
| `csharp`     | `.cs`                                      |
| `cpp`        | `.h .hpp .hh .hxx .cpp .cc .cxx .c++ .ipp` |

The reader is chosen by file extension. Force one with
`source.read('Foo.inc', { reader: 'cpp' })`.

All three use [tree-sitter](https://tree-sitter.github.io/) grammars compiled to
WebAssembly. They ship with the package, nothing is compiled on install, and a grammar
is only loaded the first time a file in that language is read. They do not need the
TypeScript compiler, the .NET SDK or a C++ toolchain, and they work on code that does
not compile.

## The model

```ts
interface ISourceFile {
  path: string;
  language: string; // reader id
  text: string;
  types: ITypeDecl[];
  functions: IFunctionDecl[]; // top-level / free functions
  namespaces: string[];
  hasErrors: boolean; // the parser found syntax errors; the model is best effort

  type(name): ITypeDecl; // throws "No type named 'X' in <path>. Found: ..." if missing
  enum(name): ITypeDecl;
  class(name): ITypeDecl; // classes, structs and records
  interface(name): ITypeDecl;
  findType(name): ITypeDecl | undefined;
  findTypes(predicate): ITypeDecl[];
}

interface ITypeDecl {
  name: string;
  kind:
    'interface' | 'class' | 'struct' | 'enum' | 'record' | 'alias' | 'union';
  namespace?: string; // 'Brew.Api' (C#), 'brew::model' (C++), 'Legacy' (TS namespace)
  exported: boolean;
  bases: string[]; // base classes and implemented interfaces
  typeParams: string[];
  fields: IFieldDecl[]; // fields and properties
  methods: IFunctionDecl[];
  members: IEnumMember[]; // enums only: { name, value? }
  aliasOf?: string; // aliases only
  attributes: string[]; // C# attributes and TypeScript decorators, without @ or []
  doc?: string; // doc comment, markers removed
  text: string; // full source text of the declaration
  raw?: unknown; // the tree-sitter node
}

interface IFieldDecl {
  name: string;
  type: string;
  optional: boolean;
  static: boolean;
  readonly: boolean;
  access?: 'public' | 'protected' | 'private' | 'internal';
  attributes: string[];
  doc?: string;
}

interface IFunctionDecl {
  name: string;
  params: { name: string; type: string; optional: boolean; default?: string }[];
  returnType: string;
  async: boolean;
  static: boolean;
  access?: string;
  attributes: string[];
  doc?: string;
  bodyText?: string; // the body without its braces
  text: string;
  raw?: unknown;
}
```

Types are kept as source text, exactly as written: `'string | undefined'`,
`'Task<ActionResult<List<TankDto>>>'`, `'const std::string&'`. Small helpers unwrap the
common cases:

| Helpers       | Functions                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `tsTypes`     | `primaryType('Foo \| undefined')`, `unwrapPromise`, `unwrapArray`, `isArrayType`, `isPrimitive`, `splitTopLevel` |
| `csharpTypes` | `unwrapTask`, `unwrapActionResult`, `unwrapNullable`, `elementType('List<T>')`                                   |
| `cppTypes`    | `stripQualifiers('const std::string&')`, `elementType('std::vector<T>')`, `unwrapWrapper('std::unique_ptr<T>')`  |

When the model does not have what you need, `bodyText`, `text` and `raw` do. For
example, NSwag-generated TypeScript clients put the HTTP method inside the body:

```ts
const method = /method:\s*"(\w+)"/.exec(endpoint.bodyText ?? '')?.[1]; // 'GET'
```

### What each language maps to

**TypeScript / JavaScript.** Interfaces, classes (including abstract), enums, type
aliases (`union` when the alias is a union), functions, and `const f = () => ...`
arrow functions. Property signatures and class fields are fields; `?` makes them
optional. `namespace` and `declare module` blocks set `namespace`.

**C#.** Classes, structs, interfaces, records (positional parameters become fields),
enums and delegates (as aliases). Properties are fields; a property without `set` or
`init` is readonly. Nullable types (`int?`) are optional. File-scoped and block
namespaces are both recorded.

**C++.** Classes, structs, unions, enums and `enum class`, `using`/`typedef` aliases,
free functions, member functions and fields with their `public`/`protected`/`private`
section. Template parameters go in `typeParams`. Declarations inside `#if`/`#ifdef`
blocks (include guards) are read. Macros are not expanded, so declarations produced by
macros are not seen.

## Other languages

Readers for other languages can be added from a config's `readers` field or with
`registerSourceReader`. A simple one takes a few lines of regular expressions; a
thorough one uses a tree-sitter grammar like the built-in readers. See
[Writing a source reader](writing-a-source-reader.md), which builds a Python reader
step by step.

## Examples

- [`examples/api-client-reader.ts`](examples/api-client-reader.ts) describes an
  NSwag-generated TypeScript API client (endpoints, HTTP methods, response content
  types, DTO interfaces). It replaces a 290-line regular-expression parser and gives
  the same result on all 59 client files of the project it came from.
- [`examples/csharp-controller.ts`](examples/csharp-controller.ts) lists ASP.NET
  controller actions with their HTTP verbs, routes and result types.
- [`examples/cpp-header.ts`](examples/cpp-header.ts) turns a C++ header's public API
  into variables for generating bindings or tests.
- [`examples/python-reader.ts`](examples/python-reader.ts) is a complete reader for
  Python, built on tree-sitter.
