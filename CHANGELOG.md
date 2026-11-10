# Changelog

## 3.0.0

A rewrite of the internals for maintainability, with new features. See
[Migrating to v3](docs/migrating-to-v3.md); `npx scaffolder migrate` converts 2.x configs.

### Breaking changes

- Node.js 22.12 or later.
- `prompts`, `variables` and `macros` functions receive one context object
  (`{ name, answers, builtins, source, variables }`) instead of positional arguments.
- `afterFileCreated` moves to `hooks.afterFileCreated` and receives
  `{ path, dryRun, variables }`. It is awaited. The top-level form still works, with a
  warning.
- A single fixed destination is `destination: 'dir'`. `destinations: 'dir'` still
  works, with a warning.
- Question types `list` and `fuzzypath` are now `select` and `path`, and `maxDepth`
  is `depthLimit`. The old names still work, with a warning.
- Types are imported from `template-scaffolder`, not `template-scaffolder/dist/types`.
- A template file that fails to render makes the run exit with code 1 (2.x exited 0).
- Unknown command-line flags are an error.
- `--rerun` no longer overrides options given on the command line.
- Configs are no longer type-checked before running; type errors do not block a template.

### New

- `scaffolder migrate` converts 2.x configs and shared helpers.
- Source readers for TypeScript, C# and C++ (`ctx.source`, `template-scaffolder/source`),
  plus custom readers. See [Source readers](docs/source-readers.md).
- `hooks.beforeRun` and `hooks.afterRun`.
- `ignore` globs for non-template files in a template folder.
- `checkbox` and `editor` questions.
- `defineConfig()` for typed configs.
- Programmatic API: `scaffold()`, `createAnswerPrompter()`, `createConsolePrompter()`,
  `createConsoleReporter()`.
- `--debug`, `--help`, `--version`; kebab-case flag aliases.
- Configs that import `template-scaffolder` get the running version (works under `npx`).

### Fixed

- The destination could not be passed on the command line (positional or
  `--destination`), although documented.
- `--workDir` was ignored when checking the scaffolding folder and reading the last-run file.
- `--rerun` replayed `false` and `0` answers as undefined.
- Choosing "Other" from a destinations list did not ask for a path.
- Helper files in a template folder were copied into the generated output.
- `#include` cycles recursed until the process crashed.
- Templates with Windows (CRLF) line endings rendered with extra blank lines and stray
  carriage returns. Output now keeps the template's line endings.
- `search` questions with `choices` were modified in place.
- `package.json#types` pointed at a file that did not exist.
- The published package included local files (`.claude/`, the last-run file).

### Internal

- A pure core (`src/core`) behind `IPrompter` / `IReporter` interfaces, a thin CLI
  (`src/cli`), and a side-effect-free entry point.
- jiti replaces config-file-ts-async (no `.template-scaffolder-ts-cache` folder);
  `node:util.parseArgs` replaces node-cli-arg-by-config; @inquirer/prompts 8.
- ESLint 9, vitest, CI on Linux and Windows, characterization tests against 2.3.12 output.

## 2.3.13 – 2.3.16

These versions were published to npm without their source being pushed. Reconstructed
from the published packages:

- `words` question type: free text split into a string array (`separator` optional).
- `CURRENT_FILE_PATH` variable: the path of the file being generated.
- `macros` as a function receives `(name, answers, variables)`.
- @inquirer/prompts 7, @types/node 20.
