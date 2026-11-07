# template-scaffolder

Scaffolding templates for your project, so your team creates new components, pages
and services the same way every time.

- Generate many files at once from [Velocity](https://velocity.apache.org/engine/1.7/user-guide.html) templates.
- Ask the user questions, compute variables, and call your own macros from templates.
- Read your existing TypeScript, C# or C++ code to drive what gets generated.
- Run formatters or `git add` after files are created.
- Use it from the command line or from code.

> **Upgrading from 2.x?** Run `npx scaffolder migrate --dryRun` to see the changes,
> then read [Migrating to v3](docs/migrating-to-v3.md).

If you feel like it...

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/sheamus)

## Contents

- [Getting started](#getting-started)
- [Command line](#command-line)
- [Template configuration](#template-configuration)
- [Questions](#questions)
- [Template files](#template-files)
- [Reading source code](#reading-source-code)
- [Programmatic API](#programmatic-api)
- [Sample project](#sample-project)

## Getting started

Requires Node.js 22.12 or later.

1. `npm install --save-dev template-scaffolder`
2. Create a `scaffolding` folder in the root of your project.
3. Create a folder inside it for your first template, e.g. `scaffolding/component`.
4. Add a `scaffolding.config.ts` (or `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`) file:

   ```ts
   import { defineConfig } from 'template-scaffolder';

   export default defineConfig({
     name: 'React component',
     destinations: ['src/components'],
   });
   ```

5. Add the files to generate, e.g. `scaffolding/component/${NAME}.tsx`:

   ```tsx
   export const ${NAME} = () => <div data-testid="${NAME}" />;
   ```

6. Run `npx scaffolder`, or add `"scaffold": "scaffolder"` to your `package.json` scripts.

The scaffolder asks for the template, a name and a destination, then writes
`src/components/MyButton/MyButton.tsx`.

Folders in `scaffolding/` whose names start with `_` are not templates. Use them for
shared helpers (`_helpers`) and for files included by other templates (`_includes`).

## Command line

```text
scaffolder [destination] [options]     generate files from a template
scaffolder migrate [folder] [options]  convert 2.x template configs to 3.x
```

Anything not given on the command line is asked for.

| Option                             | Meaning                                                                |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `--template <name>`                | Template folder, or the `name` in its config.                          |
| `--name <name>`                    | Instance name, available to templates as `NAME`.                       |
| `--destination <dir>`              | Output directory. Can also be the first argument.                      |
| `--dryRun`                         | Print what would be generated. Writes nothing and runs no commands.    |
| `--overwrite`                      | Replace existing files. By default existing files are skipped.         |
| `--parallel`                       | Load configs, render files and run hook commands concurrently.         |
| `--rerun`                          | Replay the previous run: template, name, destination and every answer. |
| `--workDir <dir>`                  | Run as if started in `<dir>`.                                          |
| `--debug`                          | Verbose output. `DEBUG=true` does the same.                            |
| `-h`, `--help` / `-v`, `--version` | Help and version.                                                      |

**Re-running.** Every run saves its answers to `.template-scaffolder-last-run`.
`--rerun` replays them, which is handy while developing a template. Options given
alongside `--rerun` win, so `scaffolder --rerun --name=Other` replays everything except
the name.

**Exit codes.** `0` success, `1` a file or command failed or the config is invalid,
`2` bad command-line arguments, `130` cancelled with Ctrl-C.

## Template configuration

Each template folder has one `scaffolding.config.*` file whose default export is the
configuration. Every field is optional. Wrap it in `defineConfig` for type checking
and editor completion; the type parameter describes your answers.

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
  stripLines: ['// TEMPLATE:', /\/\/.*\bSTRIP\b/],

  hooks: {
    afterRun: ({ createdPaths, dryRun }) =>
      dryRun ? [] : [`npx prettier --write ${createdPaths.join(' ')}`],
  },
});
```

Configs are ordinary TypeScript or JavaScript: you can import helpers, read files
and use `process.env`. TypeScript configs are loaded directly; nothing is compiled to
disk and type errors do not stop a run.

### Fields

| Field           | Default                 | Description                                                                                                                                                     |
| --------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`          | folder name             | Shown in the template list. `--template` accepts it too.                                                                                                        |
| `description`   |                         | Shown next to the name.                                                                                                                                         |
| `version`       | `'1.0'`                 | Available as `TEMPLATE_VERSION`.                                                                                                                                |
| `prompts`       | `[]`                    | [Questions](#questions) to ask. An array, or a function of `{ name, builtins, source }`.                                                                        |
| `variables`     | `{}`                    | Extra template variables. An object, or a function of `{ name, answers, builtins, source }`. May be async.                                                      |
| `macros`        | `{}`                    | Functions callable from templates as `#myMacro(...)`. An object, or a function of `{ name, answers, builtins, source, variables }`.                             |
| `destination`   |                         | A fixed output directory. The user is not asked.                                                                                                                |
| `destinations`  |                         | Output directories offered in a list, with an "Other" option.                                                                                                   |
| `createNameDir` | `true`                  | Put the files in a folder named after `NAME` inside the destination.                                                                                            |
| `srcRoot`       | `./src` or project root | Where the destination picker starts.                                                                                                                            |
| `stripLines`    | `[]`                    | Lines removed from template files before rendering. A string matches the start of the trimmed line; a RegExp is tested against the line.                        |
| `ignore`        | `[]`                    | Globs for files in the template folder that are not templates. A pattern without `/` matches file names at any depth. `scaffolding.config.*` is always ignored. |
| `hooks`         | `{}`                    | See [Hooks](#hooks).                                                                                                                                            |
| `readers`       | `[]`                    | Extra [source readers](docs/source-readers.md) for other languages.                                                                                             |

When a function is used, it receives one context object. Destructure what you need:

| Context property | In                                 | Description                                                   |
| ---------------- | ---------------------------------- | ------------------------------------------------------------- |
| `name`           | all                                | The instance name the user entered.                           |
| `builtins`       | all                                | `{ NAME, TEMPLATE_NAME, TEMPLATE_VERSION, USERNAME }`.        |
| `source`         | all                                | [Reads declarations](#reading-source-code) from source files. |
| `answers`        | variables, macros, hooks.beforeRun | Answers to the prompts, by question name.                     |
| `variables`      | macros                             | The final variables.                                          |

### Variables available to templates

Templates see, in this order of precedence (later wins): the built-in variables, the
answers to every prompt, then whatever `variables` returns.

| Built-in            | Value                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `NAME`              | The instance name.                                                                       |
| `TEMPLATE_NAME`     | The config's `name`, or the folder name.                                                 |
| `TEMPLATE_VERSION`  | The config's `version`.                                                                  |
| `USERNAME`          | git `user.name`, then git `user.email`, then the `USERNAME`/`USER` environment variable. |
| `CURRENT_FILE_PATH` | Path of the file being generated, relative to the project root.                          |

### Hooks

| Hook               | Runs                                                        | Receives                                                  | May return            |
| ------------------ | ----------------------------------------------------------- | --------------------------------------------------------- | --------------------- |
| `beforeRun`        | Once, after the questions and before any file is generated. | `{ name, answers, builtins, source }`                     | nothing               |
| `afterFileCreated` | After each file is generated, also in a dry run.            | `{ path, dryRun, variables }`                             | shell commands to run |
| `afterRun`         | Once, after all files.                                      | `{ files, createdPaths, destination, dryRun, variables }` | shell commands to run |

Hooks may be async. Returned commands run in the project root, one after another, and
never in a dry run. Their output is shown when they fail or with `--debug`.

Prefer `afterRun` for commands that work on many files at once, such as
`git add` or `prettier --write`. It is faster, and with `--parallel` it avoids
concurrent `git` commands fighting over the index lock.

## Questions

Every question has `name` (the variable that receives the answer), `message`, and
optionally `required` and `when`. `when(answersSoFar)` returns false to skip the
question; a skipped question's answer is undefined.

| `type`            | Answer   | Extra fields                                                                                                    |
| ----------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `input` (default) | string   | `default`                                                                                                       |
| `words`           | string[] | `separator` (default: whitespace), `default: string[]`                                                          |
| `number`          | number   | `default`, `min`, `max`                                                                                         |
| `confirm`         | boolean  | `default`                                                                                                       |
| `select`          | string   | `choices: IChoice[]`, `default`                                                                                 |
| `search`          | string   | either `choices: IChoice[]` or `source(input) => IChoice[] \| Promise<IChoice[]>`, `default`                    |
| `path`            | string   | `itemType: 'file' \| 'directory'`, `rootPath`, `depthLimit`, `allowManualInput`, `excludePath(info)`, `default` |
| `checkbox`        | string[] | `choices: ICheckboxChoice[]` (with `checked`), `default: string[]`                                              |
| `editor`          | string   | `default`, `postfix` (file extension for the temporary file)                                                    |

`IChoice` is `{ value: string; name?: string; description?: string; disabled?: boolean }`.

```ts
prompts: async ({ source }) => [
  {
    name: 'ROLE',
    type: 'search',
    message: 'Role required to view this page:',
    choices: (await source.read('src/enums.ts')).enum('BusinessRoles')
      .members.map(m => ({ value: m.name })),
  },
  { name: 'TAGS', type: 'words', message: 'Tags (space separated):' },
  { name: 'ENDPOINT', type: 'path', message: 'API client:', itemType: 'file',
    rootPath: 'src/data/endpoints/api', depthLimit: 1 },
],
```

## Template files

Every file in the template folder (except the config and anything in `ignore`) is
rendered with Velocity and written to the destination.

**File and folder names** may contain variables. `scaffolding/page/${NAME}/List${PLURAL_NAME}.tsx`
becomes `src/pages/Tank/ListTanks.tsx`.

**File contents** use the [Velocity Template Language](https://velocity.apache.org/engine/1.7/user-guide.html):

- `${NAME}` or `$NAME` inserts a variable. `\${NAME}` is left as is.
- `#if`, `#foreach`, `#set` and in-template `#macro` definitions work as usual.
- `#myMacro(arg1, arg2)` calls a macro from the config's `macros`.
- `#include(fileHeader.ts)` replaces the whole line with the contents of
  `scaffolding/_includes/fileHeader.ts`. Includes can include other files.

```tsx
#include(fileHeader.ts)
import { use${NAME}Styles } from './styles';

export const ${NAME} = (): ReactElement => {
#foreach($field in $FIELDS)
  const $field.name = #upperFirst($field.name);
#end
  return <div data-testid="${KEBAB_NAME}" />; // STRIP this comment from the output
};
```

A file that fails to render is reported and skipped; the other files are still
generated, and the run exits with code 1.

## Reading source code

Templates often depend on code that already exists: the endpoints of an API client,
the members of an enum, the properties of a DTO. Instead of parsing those files with
regular expressions, read them:

```ts
variables: async ({ answers, source }) => {
  const api = await source.read(answers.ENDPOINT_PATH);       // .ts, .cs, .h/.hpp/.cpp ...
  const client = api.findTypes(t => t.name.endsWith('ApiClient'))[0];
  return {
    ENDPOINTS: client.methods.filter(m => m.access !== 'protected'),
    DTO_FIELDS: api.interface('ITankDTO').fields,
  };
},
```

Built-in readers cover TypeScript/JavaScript, C# and C++. Each produces the same model:
types with fields, methods, enum members, bases, attributes and doc comments. Helper
files can use the same functions with `import { readSource } from 'template-scaffolder/source'`.
You can add readers for other languages. See [Source readers](docs/source-readers.md).

## Programmatic API

```ts
import { scaffold } from 'template-scaffolder';

const result = await scaffold({
  projectRoot: '/path/to/project',
  template: 'component',
  name: 'Button',
  destination: 'src/components',
  answers: { WITH_TESTS: true },
  dryRun: true,
});
for (const file of result.files) console.log(file.path, file.status);
```

Questions without an entry in `answers` use their default, or fail with a
`ScaffolderError` whose `code` is `MISSING_ANSWER`. Pass
`prompter: createConsolePrompter()` to ask in the terminal, or your own `IPrompter`.
Pass `reporter: createConsoleReporter({ debug: false })` to see progress.

## Sample project

```text
project
├── scaffolding
│   ├── tsconfig.json              (optional: editor support for configs)
│   ├── _helpers
│   │   └── strings.ts
│   ├── _includes
│   │   └── fileHeader.ts
│   └── component
│       ├── scaffolding.config.ts
│       ├── ${NAME}.tsx
│       ├── styles.ts
│       └── __tests__
│           └── ${NAME}.test.tsx
└── src
    └── components
```

`scaffolding/component/scaffolding.config.ts`:

```ts
import { defineConfig } from 'template-scaffolder';
import { kebabCase } from '../_helpers/strings';

export default defineConfig({
  name: 'React Component',
  description: 'for shared components',
  destinations: ['src/components'],
  variables: ({ name }) => ({
    TEST_ID: kebabCase(name),
    PROPS_INTERFACE: `I${name}Props`,
  }),
  macros: {
    repeat: (s: string, n: number) => s.repeat(n),
  },
  hooks: {
    afterRun: ({ createdPaths, dryRun }) =>
      dryRun ? [] : [`git add ${createdPaths.join(' ')}`],
  },
});
```

`scaffolding/component/${NAME}.tsx`:

```tsx
#include(fileHeader.ts)
import { ReactElement } from 'react';
import { use${NAME}Styles } from './styles';

interface $PROPS_INTERFACE {}

export const $NAME = ({}: $PROPS_INTERFACE): ReactElement => {
  use${NAME}Styles();
  return <div data-testid="${TEST_ID}">{`escaped: \${notAVariable}`}</div>;
};
```

`scaffolding/_includes/fileHeader.ts`:

```ts
/**
 * Generated by the $TEMPLATE_NAME template (v$TEMPLATE_VERSION) for $USERNAME.
 */
```

The repository's own [`scaffolding`](scaffolding) folder has more examples, and
[`docs/examples`](docs/examples) shows source readers in use.
