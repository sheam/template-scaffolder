[Docs](README.md) › Writing a source reader

# Writing a source reader

The built-in readers cover TypeScript/JavaScript, C# and C++. For any other language,
or for a file format of your own, you can write a reader. Once registered, it works
exactly like the built-in ones: `source.read('app/models.py')` in configs and
`readSource()` in helpers, with the same model and the same query helpers
(`file.class('Tank')`, `file.enum(...)`, `file.findTypes(...)`).

This guide covers:

1. [What a reader is](#what-a-reader-is)
2. [A quick reader with regular expressions](#a-quick-reader-with-regular-expressions)
3. [Registering a reader](#registering-a-reader)
4. [A full reader with tree-sitter](#a-full-reader-with-tree-sitter), built step by
   step for Python
5. [Testing a reader](#testing-a-reader)

## What a reader is

A reader is an object with an id, the file extensions it handles, and a `read`
function that turns a file's text into the [model](source-readers.md#the-model):

```ts
import { defineSourceReader } from 'template-scaffolder/source';

export const myReader = defineSourceReader({
  id: 'mylang',
  extensions: ['.my'],
  async read({ path, text }) {
    return {
      path, // as given
      language: 'mylang', // the reader's id
      text, // as given
      types: [], // classes, structs, interfaces, enums, records, aliases
      functions: [], // top-level functions
      namespaces: [], // namespaces, packages or modules declared in the file
      hasErrors: false, // true if the file could not be fully understood
    };
  },
});
```

`defineSourceReader` returns the reader unchanged; it is there for type checking.
The query helpers are added for you.

A few conventions keep templates working the same way across languages:

- **Keep types as source text**, exactly as written: `'Optional[float]'`,
  `'List<Order>'`. Do not try to resolve them.
- **Map the language's concepts onto the nearest kind.** Python classes and Go
  structs are `class` and `struct`; Protocol Buffers messages are `class`; Python
  `Enum` subclasses are `enum`. Properties, attributes and annotated members are
  `fields`.
- **Read what you can.** Source files are often mid-edit. Return what you found and
  set `hasErrors: true`, rather than throwing.
- **Fill in `text`** for each declaration, and `bodyText` for functions. Template
  authors use them for details the model does not have.
- **Put the parser's node in `raw`**, if there is one, for the same reason.

## A quick reader with regular expressions

For a simple format, regular expressions are enough. This reader reads Protocol
Buffers messages as classes with fields:

```ts
// scaffolding/_helpers/protoReader.ts
import { defineSourceReader } from 'template-scaffolder/source';

export const protoReader = defineSourceReader({
  id: 'proto',
  extensions: ['.proto'],
  async read({ path, text }) {
    const types = [...text.matchAll(/message\s+(\w+)\s*{([^}]*)}/g)].map(
      ([full, name, body]) => ({
        name,
        kind: 'class' as const,
        exported: true,
        bases: [],
        typeParams: [],
        members: [],
        methods: [],
        attributes: [],
        text: full,
        fields: [
          ...body.matchAll(/(optional\s+)?([\w.]+)\s+(\w+)\s*=\s*\d+;/g),
        ].map(m => ({
          name: m[3],
          type: m[2],
          optional: !!m[1],
          static: false,
          readonly: false,
          attributes: [],
        })),
      })
    );
    return {
      path,
      language: 'proto',
      text,
      types,
      functions: [],
      namespaces: [],
      hasErrors: false,
    };
  },
});
```

Regular expressions break down on nesting, comments and strings. When that matters,
use a grammar.

## Registering a reader

**For one template**, list it in the config's `readers`:

```ts
import { defineConfig } from 'template-scaffolder';
import { protoReader } from '../_helpers/protoReader';

export default defineConfig({
  readers: [protoReader],
  variables: async ({ source }) => ({
    MESSAGES: (await source.read('api/tanks.proto')).types,
  }),
});
```

**Everywhere**, including `readSource()` in helper files, call
`registerSourceReader` in a helper that your configs import:

```ts
// scaffolding/_helpers/readers.ts
import { registerSourceReader } from 'template-scaffolder/source';
import { protoReader } from './protoReader';

registerSourceReader(protoReader);
```

The reader is picked by file extension. To use it for a file with another
extension, name it: `source.read('legacy/tanks.txt', { reader: 'proto' })`.

A reader with the same id or extension as a built-in reader replaces it, so you can
also swap out a built-in reader.

## A full reader with tree-sitter

[tree-sitter](https://tree-sitter.github.io/) has grammars for well over a hundred
languages. It parses a file into a syntax tree, recovers from errors, and is what the
built-in readers use. template-scaffolder includes the tree-sitter runtime, so all a
new language needs is its grammar.

The steps below build a reader for Python. The finished reader, about 200 lines, is
[`examples/python-reader.ts`](examples/python-reader.ts), and it is tested against
[a sample file](../test/fixtures/source/models.py).

### 1. Get the grammar

Grammars are published on npm as `tree-sitter-<language>`. Recent versions include a
ready-built `.wasm` file:

```sh
npm install --save-dev tree-sitter-python
```

Find the file's path from your reader:

```ts
import { createRequire } from 'node:module';

const GRAMMAR = createRequire(import.meta.url).resolve(
  'tree-sitter-python/tree-sitter-python.wasm'
);
```

If a grammar package has no `.wasm` file, build one with the
[tree-sitter CLI](https://tree-sitter.github.io/tree-sitter/cli/build.html)
(`tree-sitter build --wasm`) and commit it next to your reader.

### 2. Look at the tree

`parseWithGrammar(grammar, text)` returns the root node. Its `toString()` shows the
whole tree, including the field names you will use to find things:

```ts
import { parseWithGrammar } from 'template-scaffolder/source';

const root = await parseWithGrammar(
  GRAMMAR,
  `
class Tank(Base):
    id: int
    def fill(self, litres: float = 10) -> bool:
        return True
`
);
console.log(root.toString());
```

```text
(module
  (class_definition
    name: (identifier)
    superclasses: (argument_list (identifier))
    body: (block
      (expression_statement
        (assignment left: (identifier) type: (type (identifier))))
      (function_definition
        name: (identifier)
        parameters: (parameters
          (identifier)
          (typed_default_parameter
            name: (identifier) type: (type (identifier)) value: (integer)))
        return_type: (type (identifier))
        body: (block (return_statement (true)))))))
```

(The output is on one line; it is indented here to make it readable.)
The [tree-sitter playground](https://tree-sitter.github.io/tree-sitter/7-playground.html)
does the same in a browser.

The parts of the node API you will need:

| Member                         | Returns                                                       |
| ------------------------------ | ------------------------------------------------------------- |
| `node.type`                    | The node's kind, such as `'class_definition'`.                |
| `node.text`                    | The node's source text.                                       |
| `node.childForFieldName(name)` | The child in a named field (`name:`, `body:` above), or null. |
| `node.namedChildren`           | Children that are nodes (not punctuation or keywords).        |
| `node.children`                | All children, including keywords such as `async`.             |
| `node.firstNamedChild`         | The first named child, or null.                               |
| `node.hasError`                | True if the node or anything inside it has a syntax error.    |

In TypeScript, the node type is `SyntaxNode` from `template-scaffolder/source`.
Lists of children are typed as possibly containing `null`, so filter those out.

### 3. Walk the top level

The reader parses the file and looks at each top-level statement. In Python, a
decorated class is wrapped in a `decorated_definition` node, so unwrap it first:

```ts
import {
  defineSourceReader,
  parseWithGrammar,
  type IFunctionDecl,
  type ITypeDecl,
  type SyntaxNode,
} from 'template-scaffolder/source';

export const pythonReader = defineSourceReader({
  id: 'python',
  extensions: ['.py', '.pyi'],
  async read({ path, text }) {
    const root = await parseWithGrammar(GRAMMAR, text);
    const types: ITypeDecl[] = [];
    const functions: IFunctionDecl[] = [];
    for (const node of root.namedChildren) {
      const { definition, decorators } = unwrapDecorators(node);
      if (definition?.type === 'class_definition') {
        types.push(readClass(definition, decorators));
      } else if (definition?.type === 'function_definition') {
        functions.push(readFunction(definition, decorators));
      }
    }
    return {
      path,
      language: 'python',
      text,
      types,
      functions,
      namespaces: [],
      hasErrors: root.hasError,
    };
  },
});

function unwrapDecorators(node: SyntaxNode | null) {
  if (node?.type !== 'decorated_definition') {
    return { definition: node, decorators: [] };
  }
  return {
    definition: node.childForFieldName('definition'),
    decorators: node.namedChildren
      .filter(c => c?.type === 'decorator')
      .map(d => d!.text.replace(/^@/, '')), // '@dataclass' -> 'dataclass'
  };
}
```

Decorators become `attributes`, as C# attributes and TypeScript decorators do in the
built-in readers.

### 4. Read a declaration

Map each part of the tree onto the model. For a class: the name and bases come from
fields, annotated assignments in the body become fields, and functions in the body
become methods:

```ts
function readClass(node: SyntaxNode, decorators: string[]): ITypeDecl {
  const name = node.childForFieldName('name')?.text ?? '';
  const bases =
    node.childForFieldName('superclasses')?.namedChildren.map(b => b!.text) ??
    [];
  const isEnum = bases.some(b => /\b(Enum|IntEnum|StrEnum|Flag)$/.test(b));
  // ... loop over node.childForFieldName('body').namedChildren
  //     to collect fields, enum members and methods

  return {
    name,
    kind: isEnum ? 'enum' : 'class',
    exported: !name.startsWith('_'), // Python's convention for private names
    bases,
    typeParams: [],
    fields,
    methods,
    members,
    attributes: decorators,
    doc: docstring(statements[0]),
    text: node.text,
    raw: node,
  };
}
```

Where the language has no direct equivalent, choose the closest meaning and say so
in a comment. Python has no `public`/`private`, so the example treats names starting
with `_` as private, which is what Python programmers mean by them.

Parameters show why it pays to look at the tree first: Python has six kinds
(`identifier`, `typed_parameter`, `default_parameter`, `typed_default_parameter`,
`*args` and `**kwargs`), each with different fields. Handle each one with a `switch`
on `node.type`, and return `null` for anything you do not need, such as the bare `*`
separator. The full version is in
[`examples/python-reader.ts`](examples/python-reader.ts).

### 5. Use it

```ts
import { defineConfig } from 'template-scaffolder';
import { pythonReader } from '../_helpers/pythonReader';

export default defineConfig({
  readers: [pythonReader],
  prompts: [
    {
      name: 'MODEL_FILE',
      type: 'path',
      message: 'Model file:',
      rootPath: 'app/models',
      itemType: 'file',
    },
  ],
  variables: async ({ answers, source }) => {
    const models = await source.read(answers.MODEL_FILE);
    const model = models.findTypes(t => t.attributes.includes('dataclass'))[0];
    return { MODEL: model, FIELDS: model.fields.filter(f => !f.static) };
  },
});
```

The grammar is loaded the first time a Python file is read, and each file is parsed
once per run.

## Testing a reader

`checkSourceReader(reader, { path, text })` checks that a reader's output has the
shape of the model, and returns a list of problems. Use it alongside tests of what
the reader found:

```ts
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { checkSourceReader, withQueries } from 'template-scaffolder/source';
import { pythonReader } from './pythonReader';

it('reads models.py', async () => {
  const sample = {
    path: 'models.py',
    text: readFileSync('fixtures/models.py', 'utf-8'),
  };
  expect(await checkSourceReader(pythonReader, sample)).toEqual([]);

  const file = withQueries(await pythonReader.read(sample));
  expect(file.class('Tank').fields.map(f => f.name)).toEqual([
    'table',
    'id',
    'name',
    'capacity',
  ]);
  expect(file.enum('TankStatus').members.map(m => m.name)).toEqual([
    'EMPTY',
    'FERMENTING',
  ]);
});
```

`withQueries` adds the query helpers (`class()`, `enum()`, `findTypes()`) to a
reader's output, as `source.read` does.

Test with code that does not parse, too. The reader should still return what it
could, with `hasErrors: true`.

## Contributing a built-in reader

If your reader would be useful to others, consider contributing it.
[CONTRIBUTING.md](../CONTRIBUTING.md#adding-things) lists the steps.
