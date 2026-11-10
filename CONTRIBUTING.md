# Contributing

## Setup

Requires Node.js 22.12 or later.

```sh
npm ci
npm run check     # lint, typecheck and tests: what CI runs, on Linux and Windows
```

| Script                            | Does                                                                   |
| --------------------------------- | ---------------------------------------------------------------------- |
| `npm test` / `npm run test:watch` | Run the tests with vitest.                                             |
| `npm run build`                   | Compile to `dist/` and copy the tree-sitter grammars to `grammars/`.   |
| `npm run test:characterization`   | Build, then compare the CLI's output with output captured from 2.3.12. |
| `npm run lint` / `lint:fix`       | ESLint over `src`, `test` and `docs/examples`.                         |
| `npm run format`                  | Prettier.                                                              |

A husky pre-commit hook runs ESLint and Prettier on staged files.

To try the CLI on this repository's own `scaffolding` folder:

```sh
npm run build && node dist/cli/main.js --dryRun
```

## How the code is organised

```text
src/
  index.ts       public API: scaffold(), createAnswerPrompter(), defineConfig, types
  cli/           the command line: argument parsing, terminal prompts, console output
  core/          the scaffolder itself: no console, no process.exit, no global state
  source/        source readers (template-scaffolder/source)
  migrate/       scaffolder migrate: the 2.x to 3.x config converter
```

The rules that keep it maintainable:

- **`src/core` never touches the terminal.** It asks questions through `IPrompter`,
  reports through `IReporter` and runs shell commands through `CommandRunner`
  (`core/ports.ts`). The CLI supplies console versions; tests and `scaffold()` callers
  supply their own.
- **Errors are thrown, not exited.** Throw `ScaffolderError(code, message)` from
  `core/errors.ts`. Only `cli/main.ts` calls `process.exit`, and it maps errors to exit
  codes (`0` ok, `1` failed, `2` usage, `130` cancelled).
- **Configs are normalized once.** `core/config.ts` turns whatever the user wrote
  (values or functions, legacy 2.x names) into `INormalizedConfig`. Everything after
  that relies on the normalized shape and never re-checks the user's config.
- **User objects are not mutated.** Validation in `core/questions.ts` returns copies.
- **Importing the package has no side effects.**

### The pipeline

`core/run.ts` `run(options, deps)` calls each stage in order:

1. `options.ts`: merge command-line options with the last run (`--rerun`). Explicit
   options win.
2. `templates.ts` and `configLoader.ts`: find the template folders and load their
   configs with jiti. `config.ts` normalizes each config.
3. Ask for the name, then build the built-in variables (`builtIns.ts`).
4. `questions.ts` validates `prompts`, then `answers.ts` asks them. Answers given in
   advance are checked and converted to the question's type instead (`priorAnswer`).
5. Resolve the destination: fixed, chosen from `destinations`, or asked for, and
   offer to create it if it does not exist.
6. Run `hooks.beforeRun`, then `variables` and `macros`.
7. `plan.ts`: list the template files, apply `ignore`, substitute variables in paths,
   and decide which files to write, overwrite or skip.
8. `generate.ts`: render (`render.ts`: `#include`, `stripLines`, `keepLineBreaks`,
   Velocity, and unknown variables), write files one at a time, and run
   `afterFileCreated` commands.
9. Run `hooks.afterRun`, and save the answers to `.template-scaffolder-last-run`
   (`lastRun.ts`) unless `saveLastRun` is false.

Hooks get one shared `IHookContext`, built after the destination is chosen. Errors
from `beforeRun` and `afterRun` are wrapped as `HOOK_FAILED` by `callHook`.

Loading configs and rendering always use `concurrency.ts` `mapConcurrent` with
`parallel: true`; `--parallel` only applies to `afterFileCreated` commands. Results
always come back in template order, and files are always written one at a time.

`scaffolder init` and `scaffolder list` are `core/init.ts` and `listTemplates()` in
`src/index.ts`.

## Adding things

**A question type.**

1. Add an interface to the `Question` union in `core/types.ts`, and the type name to
   `QuestionType`.
2. Add the name to `QUESTION_TYPES` in `core/questions.ts`, with any extra validation.
3. Ask it in `cli/prompter.ts`.
4. Give it a fallback answer in `createAnswerPrompter` (`src/index.ts`).
5. Add a case to `test/unit/prompter.test.ts`. It drives the real inquirer prompts
   through fake streams.

**A hook.** Add it to `IHooks` in `core/types.ts` with its context type, accept it
in `normalizeHooks` (`core/config.ts`), and call it from `run.ts` or `generate.ts`.
Hooks that return commands should run them with `runCommands` so they show up in the
results and respect `--dryRun`.

**A config field.** Add it to `IConfigFile`, to the list of known keys and to
`INormalizedConfig` (with its default) in `core/config.ts`, then use it from the
normalized config.

**A command-line option.** Add it to `cli/args.ts`: the `parseArgs` options, the
`HELP` text and the command type. If it changes a run, add it to `IRunOptions` in
`core/options.ts` too, so `scaffold()` gets it as well.

**A built-in source reader.**

1. Add the grammar package as an exact-pinned dev dependency, and list its `.wasm` in
   `scripts/copy-grammars.mjs` and `BUILT_IN_GRAMMARS` (`source/treeSitter.ts`).
2. Write `source/readers/<language>.ts`. Use the existing readers as models.
3. Add it to `BUILT_IN_READERS` in `source/api.ts`.
4. Add a fixture to `test/fixtures/source` and tests to `test/source/readers.test.ts`.
   The tests check every reader's output with `checkSourceReader`.

Document anything users see in the matching page in `docs/` (the
[docs index](docs/README.md) lists them), and add a line to `CHANGELOG.md`. Code
examples in `docs/examples` are type-checked and tested, so keep longer examples
there. `README.md` is an overview; keep details out of it.

## Tests

| Folder                  | Covers                                                                       |
| ----------------------- | ---------------------------------------------------------------------------- |
| `test/unit`             | Config normalization, options, questions, the console prompter.              |
| `test/e2e`              | `run()` against copies of `scaffolding/` in temp folders, and the built CLI. |
| `test/source`           | Each reader against the files in `test/fixtures/source`.                     |
| `test/migrate`          | The converter, including the 2.x configs in `test/fixtures/v2`.              |
| `test/docs`             | The code in `docs/examples` keeps working.                                   |
| `test/characterization` | The built CLI's output against output captured from 2.3.12.                  |

`test/helpers.ts` has `tempProject()`, `scriptedPrompter()` and `memoryReporter()`.
Never edit `test/fixtures/v2`. It holds byte-exact 2.x configs that the converter is
tested against, and Prettier and ESLint are told to skip it.

When a change to the output is intended, recapture the characterization output with
`node test/characterization/harness.mjs --capture` and review the git diff.

## Releasing

1. Update `CHANGELOG.md` and run `npm version <major|minor|patch>`.
2. Push the commit and the tag, then publish a GitHub release for the tag.
   `.github/workflows/publish.yml` runs on the release and publishes to npm.

`package.json` `files` lists exactly what is published. Check it with
`npm pack --dry-run`.
