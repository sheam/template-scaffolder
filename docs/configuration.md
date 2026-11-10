[Docs](README.md) › Configuration

# Configuration

Each template folder has one `scaffolding.config.*` file (`.ts`, `.mts`, `.cts`,
`.js`, `.mjs` or `.cjs`). Its default export is the configuration. Every field is
optional.

```ts
import { defineConfig } from 'template-scaffolder';

interface IAnswers {
  PLURAL_NAME: string;
  WITH_TESTS: boolean;
}

export default defineConfig<IAnswers>({
  name: 'Feature',
  description: 'A feature folder with a list page and services',
  version: '2.1',

  prompts: ({ name }) => [
    { name: 'PLURAL_NAME', message: 'Plural name:', default: `${name}s` },
    {
      name: 'WITH_TESTS',
      type: 'confirm',
      message: 'Add tests?',
      default: true,
    },
  ],

  variables: ({ name, answers }) => ({
    KEBAB_NAME: name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
    LIST_PAGE: `List${answers.PLURAL_NAME}`,
  }),

  macros: {
    upperFirst: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
  },

  destinations: ['src/pages/setup', 'src/pages/production'],
  ignore: ['helpers.ts'],
  stripLines: ['// TEMPLATE:'],

  hooks: {
    afterRun: ({ createdPaths, dryRun }) =>
      dryRun ? [] : [`npx prettier --write ${createdPaths.join(' ')}`],
  },
});
```

`defineConfig` returns the object unchanged. It gives type checking and completion in
TypeScript, and in JavaScript editors that read JSDoc types. The type parameter
describes your answers, so `answers.PLURAL_NAME` is typed.

Configs are ordinary code: they can import helpers, read files and use
`process.env`. TypeScript is run directly. Nothing is compiled to disk, and type
errors do not stop a run, so check types with your editor or `tsc`.

## Fields

| Field                       | Default                 | Description                                                                                   |
| --------------------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| `name`                      | folder name             | Shown in the template list. `--template` accepts it too.                                      |
| `description`               |                         | Shown next to the name.                                                                       |
| `version`                   | `'1.0'`                 | Available to templates as `TEMPLATE_VERSION`.                                                 |
| `prompts`                   | `[]`                    | [Questions](questions.md) to ask.                                                             |
| `variables`                 | `{}`                    | Extra variables for templates.                                                                |
| `macros`                    | `{}`                    | Functions templates call as `#name(...)`. See [macros](templates.md#macros).                  |
| `destination`               |                         | A fixed output folder. The user is not asked.                                                 |
| `destinations`              |                         | Output folders offered in a list, with "Other".                                               |
| `createNameDir`             | `true`                  | Put the files in a folder named after `NAME` inside the destination.                          |
| `srcRoot`                   | `./src` or project root | Where the destination folder picker starts.                                                   |
| [`stripLines`](#striplines) | `[]`                    | Lines to remove from template files before rendering.                                         |
| [`ignore`](#ignore)         | `[]`                    | Files in the template folder that are not templates.                                          |
| `hooks`                     | `{}`                    | Functions run before and after generating. See [Hooks](hooks.md).                             |
| `readers`                   | `[]`                    | Source readers for more languages. See [Writing a source reader](writing-a-source-reader.md). |

See [how the destination is chosen](command-line.md#how-each-value-is-chosen).

## Functions and their context

`prompts`, `variables` and `macros` can each be a value or a function returning one.
Functions may be async. Each receives one context object; destructure what you need.

```ts
prompts: async ({ name, source }) => [...],
variables: async ({ name, answers, builtins, source }) => ({...}),
macros: ({ variables }) => ({...}),
```

| Property    | Available in                             | Value                                                                 |
| ----------- | ---------------------------------------- | --------------------------------------------------------------------- |
| `name`      | all                                      | The name entered by the user.                                         |
| `builtins`  | all                                      | `{ NAME, TEMPLATE_NAME, TEMPLATE_VERSION, USERNAME }`.                |
| `source`    | all                                      | Reads your source code. See [Reading source code](source-readers.md). |
| `answers`   | `variables`, `macros`, `hooks.beforeRun` | The answers, by question name.                                        |
| `variables` | `macros`                                 | Every variable templates will see.                                    |

They run in this order: `prompts`, the questions are asked, the destination is chosen,
`hooks.beforeRun`, `variables`, `macros`. Then the files are generated.

## Variables available to templates

Templates see three sets of variables. When names collide, later ones win:

1. **Built-ins**:

   | Variable            | Value                                                                                       |
   | ------------------- | ------------------------------------------------------------------------------------------- |
   | `NAME`              | The name entered by the user.                                                               |
   | `TEMPLATE_NAME`     | The config's `name`, or the folder name.                                                    |
   | `TEMPLATE_VERSION`  | The config's `version`.                                                                     |
   | `USERNAME`          | git `user.name`, then git `user.email`, then the `USERNAME` or `USER` environment variable. |
   | `CURRENT_FILE_PATH` | The path of the file being generated, relative to the project root.                         |

2. **Answers**, by question name.
3. **Whatever `variables` returns.**

Variable values can be any type. Objects and arrays work with `#foreach` and property
access (`$endpoint.name`) in templates.

## stripLines

Lines in template files that match are removed before rendering. Use it for notes to
template authors, or for code that keeps a template valid in your editor but should
not be generated.

```ts
stripLines: [
  '// TEMPLATE:',            // a string matches lines that start with it (ignoring indentation)
  /\/\/.*\bSTRIP\b/,         // a RegExp is tested against the whole line
],
```

```ts
// TEMPLATE: this comment is for template authors and is not generated
import { placeholder } from './placeholder'; // STRIP: only here so the editor is happy
```

## ignore

Every file in a template folder is generated, except the config and anything matching
`ignore`. Patterns use glob syntax:

- A pattern without `/` matches file names at any depth: `'*.md'`, `'helpers.ts'`.
- A pattern with `/` matches the path inside the template folder: `'notes/**'`,
  `'fixtures/*.json'`.

```ts
ignore: ['helpers.ts', 'README.md', 'notes/**'],
```

## Sharing config between templates

Put shared settings in a function in `_helpers` and spread it into each config:

```ts
// scaffolding/_helpers/defaultConfig.ts
import type { IConfigFile } from 'template-scaffolder';
import { lowerFirst, upperFirst } from './strings';

export function defaultConfig<T extends object>(): IConfigFile<T> {
  return {
    stripLines: [/\/\/.*\bSTRIP\b/],
    macros: { lowerFirst, upperFirst },
    hooks: {
      afterRun: ({ createdPaths, dryRun }) =>
        dryRun ? [] : [`npx prettier --write ${createdPaths.join(' ')}`],
    },
  };
}
```

```ts
// scaffolding/page/scaffolding.config.ts
import { defineConfig } from 'template-scaffolder';
import { defaultConfig } from '../_helpers/defaultConfig';

export default defineConfig<IAnswers>({
  ...defaultConfig<IAnswers>(),
  name: 'Page',
  destinations: ['src/pages'],
});
```

Folders starting with `_` are never offered as templates.

## Validation

Configs are checked when they load. Fields of the wrong type, unknown hooks, and
questions without a `name` or `message`, with an unknown type, or (for `select` and
`checkbox`) without `choices` are reported together with the template name, and the
run stops with exit code 1. Unknown fields are ignored with a warning, which catches
typos such as `destinaton`.

2.x names (`list`, `fuzzypath`, `maxDepth`, a top-level `afterFileCreated`,
`destinations` as a string) still work, with a warning. `scaffolder migrate` updates
them. See [Migrating to v3](migrating-to-v3.md).
