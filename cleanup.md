# template-scaffolder v3: re-architecture plan

> **Status: complete.** All 12 steps are done on the `v3` branch. This file records the plan
> and the decisions behind it. The "Target architecture" section below is the original
> plan, and a few planned files ended up merged (for example `context.ts`, `process.ts`
> and `hooks.ts` became part of `run.ts` and `generate.ts`). For the code as it is now,
> see [CONTRIBUTING.md](CONTRIBUTING.md).

## Context

`template-scaffolder` is a ~2k LOC TypeScript CLI (v2.3.12) that renders Velocity templates from a `scaffolding/` folder. It works, but adding features is painful because:

- **Everything is a script.** `src/index.ts` runs at import time with top-level `await`; there is no `main`/`exports`, so nothing can call it from code or from a test. There is exactly one unit test.
- **Seven `process.exit()` calls** scattered through `cli.ts`, `util.ts`, `rerun.ts`, `config/index.ts`, `prompts/helpers.ts` make every path untestable and hide errors.
- **Option precedence (lastRun > cli > config > prompt) is re-derived in four places** (`index.ts`, `config/index.ts`, `getInitialInputs.ts`, `finalizeInputs.ts`). Any new option has to be threaded through all of them.
- **Two logging systems**: global `log()/logError()` and a buffered `Logger` class with manual `indent()/unindent()` passed through every function (and `unindent()` is a no-op bug).
- **Parallel and serial branches are duplicated** in `getTemplateDescriptors.ts` and `templateProcessing/index.ts`.
- **A pervasive `TInput` generic** that is always instantiated as `never`, side-effecting type guards (`isSelectQuestion` logs errors), and config objects mutated in place (`getSearchQuestion` deletes `q.choices`).
- **Tooling is broken on a fresh clone**: `.eslintrc` is unsupported by current ESLint, jest+ts-jest ESM preset fails, `@types/node@16` while running Node 26, the publish workflow runs a non-existent `npm run build`, `glob` is an unused dependency, `.idea/` is committed, `test:bn` has a hard-coded Windows path.

Decisions already made with the user:

| Decision                       | Choice                                                                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Compatibility                  | Breaking **v3.0.0** is fine. Keep the _spirit_ of `scaffolding.config.*` but allowed to change shape.                                                                                                                                            |
| Surface                        | **CLI + programmatic library** (`scaffold()` export).                                                                                                                                                                                            |
| Dependencies                   | Replace `config-file-ts-async` with **jiti**, `node-cli-arg-by-config` with **`node:util.parseArgs`**.                                                                                                                                           |
| Upcoming features              | **Lifecycle hooks** and **richer prompt types** — these get first-class seams.                                                                                                                                                                   |
| Unpushed 2.3.13–2.3.16         | Source exists only on npm. **Fold into v3** directly: `words` question type, `CURRENT_FILE_PATH` built-in, `macros(name, answers, variables)`. No history restore.                                                                               |
| Converter                      | `scaffolder migrate` rewrites 2.x configs and helper files to 3.x; documented in `docs/migrating-to-v3.md`.                                                                                                                                      |
| Engine for readers + converter | **tree-sitter (WASM) for every language**, grammars bundled (~1 MB compressed). Decided during step 1: TypeScript 7 only exposes an "unstable" compiler API, so depending on the user's `typescript` would break on TS 7. No optional peer deps. |
| Node floor                     | **>= 22.12**. Node 20 is EOL and vitest 5 requires 22.12.                                                                                                                                                                                        |
| Source readers                 | **Ship in v3**, pluggable: one language-neutral declaration model, a `SourceReader` interface, built-in readers for **TypeScript, C#, C++**, and custom readers registered from config. Replaces regex parsing like BrewNinja's helpers.         |

Real-world corpus: `~/code/BrewNinja/StrangeBrewWeb/StrangeBrew.App/scaffolding/` (9 templates, 2.3.16). It is **only ever copied** into the scratchpad for testing, never modified in place. Patterns it relies on that v3 and the converter must handle:

- Imports types from the deep path `template-scaffolder/dist/types`.
- Shared defaults via `...getDefaultConfig()` in `_helpers/defaultConfig.ts`, which sets `afterFileCreated`, `stripLines`, and `macros` outside any `scaffolding.config.*`.
- `afterFileCreated: formatFileCommand` as a function reference, not an inline arrow.
- `variables`/`prompts` as async functions doing file I/O; `prompts` awaits `getEnumValueChoices()` to build `search` choices.
- `type: 'words'` prompts, `depthLimit`, `module: CommonJS` scaffolding tsconfig, imports of `./helpers.js` that resolve to `helpers.ts`.
- Heavy Velocity: `#foreach`, `#if`, in-template `#macro`, config macros called with object arguments.
- `--parallel` in most npm scripts, and per-file `npx prettier --write` hooks.

Outcome: a pure, testable core with one pipeline, one reporter, one config shape, a thin CLI, a real test suite, and modern tooling. BrewNinja's templates convert with one command and produce identical output. The first new feature (config-level `ignore` patterns) ships on the new base as proof.

## Target architecture

```
src/
  index.ts                 public API: scaffold(), defineConfig(), types   (no side effects)
  cli/
    main.ts                #!/usr/bin/env node — chdir(workDir), parseArgs, run, exit code
    args.ts                node:util.parseArgs definitions + help text
    prompter.ts            Prompter impl over @inquirer/prompts (one file per type is overkill)
    reporter.ts            Reporter impl over console (colours/indent live here only)
  core/
    types.ts               public config types (IConfigFile, Question union, hooks)
    errors.ts              ScaffolderError{code}, UserCancelledError
    run.ts                 run(options, deps): the pipeline, ~60 lines, calls stages in order
    options.ts             resolveCliOptions(argv, lastRun) -> CliOptions   (pure, cli > lastRun)
    templates.ts           discover + select + load  -> resolveTemplate()
    config.ts              normalizeConfig(raw) -> TemplateConfig | ConfigError[]
    answers.ts             collectAnswers(questions, prompter, priorAnswers)
    context.ts             buildContext(): builtins + answers + variables + macros
    plan.ts                planFiles(templateDir, ctx, ignore) -> FilePlan[]   (pure)
    render.ts              renderFile(): includes + stripLines + velocity   (pure given fs read)
    process.ts             processFile(plan, ctx, deps) -> FileResult; runs hooks
    lastRun.ts             load/save .template-scaffolder-last-run
    hooks.ts               hook dispatch (beforeRun, afterFileCreated, afterRun)
    concurrency.ts         mapConcurrent(items, fn, {parallel})
    paths.ts               toPosix(), scaffoldingPath(), existsAsync(), isDirectory()
  __tests__/               vitest; fixtures reuse the in-repo scaffolding/ folder
```

Key interfaces (core never touches console or `process.exit`):

```ts
interface Prompter { ask<T>(q: Question): Promise<T> }            // CLI: inquirer; tests: scripted
interface Reporter { info/warn/error/debug(msg); fileResult(r: FileResult) }
interface RunDeps  { prompter: Prompter; reporter: Reporter; configLoader: ConfigLoader; projectRoot: string }

type CliOptions   = { template?, name?, destination?, dryRun, overwrite, parallel, rerun, workDir? }
type TemplateConfig = {           // the ONE normalized shape the core uses
  name, description, version,
  variables: (ctx) => Promise<Vars>,   // value-or-function canonicalized to function
  prompts:   (ctx) => Promise<Question[]>,
  macros:    (ctx) => Promise<Macros>,
  destinations: string[], createNameDir: boolean, srcRoot?: string,
  stripLines: (string|RegExp)[], ignore: string[],
  hooks: { beforeRun?, afterFileCreated?, afterRun? }
}
type FilePlan   = { sourcePath, destPath, action: 'write'|'overwrite'|'skip-exists' }
type FileResult = { plan, status: 'written'|'skipped'|'dry-run'|'error', content?, messages[] }
```

Pipeline in `run.ts`:
`resolveCliOptions → resolveTemplate → normalizeConfig → collectAnswers → buildContext → planFiles → mapConcurrent(renderFile) → processFiles (writes + hooks, serial) → saveLastRun`

v3 user-facing config shape (type names keep their `I` prefix to minimise churn; only the import path changes):

```ts
import { defineConfig } from 'template-scaffolder';
export default defineConfig<IUserInputs>({
  name, description, version,
  prompts?:   Question[] | (ctx: { name, builtins }) => Question[] | Promise<Question[]>,
  variables?: Vars       | (ctx: { name, answers, builtins }) => Vars | Promise<Vars>,
  macros?:    Macros     | (ctx: { name, answers, builtins, variables }) => Macros | Promise<Macros>,
  destination?: string,            // was destinations: 'x' (fixed, no prompt)
  destinations?: string[],         // pick list + Other
  createNameDir?, srcRoot?, stripLines?, ignore?: string[],
  hooks?: {
    beforeRun?(ctx),
    afterFileCreated?(ctx: { path, dryRun, variables }) => string[] | void | Promise<...>,
    afterRun?(ctx: { files: FileResult[], dryRun, variables }) => string[] | void | Promise<...>,
  },
});
```

Question types: `input`, `words` (from 2.3.16, `separator?`), `number`, `confirm`, `select`, `search`, `path` (+ `checkbox`, `editor` in step 8). Built-ins: `NAME`, `TEMPLATE_NAME`, `TEMPLATE_VERSION`, `USERNAME`, `CURRENT_FILE_PATH` (per file).

Deliberate behaviour changes (all v3 release notes):

- Precedence becomes **cli > lastRun > config > prompt** (today `--rerun --name=X` silently ignores `X`).
- `afterFileCreated` is **awaited** and may return `string[] | null | void`, matching the README.
- Writes and hook commands run **serially even in `--parallel`** (rendering stays parallel). Today parallel `git add` races on the index lock.
- `list` / `fuzzypath` aliases removed; `normalizeConfig` maps them with a deprecation warning for one release.
- Node floor **>= 22.12** (Node 20 is EOL; vitest 5 and `@inquirer/prompts@8` need it).

## Bugs fixed along the way (verified in source)

| Bug                                                                                                                                                    | Where                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `verifyScaffoldingFolder()`, `loadLastRun()` and `LAST_RUN_CONFIG_PATH` all evaluate **before** `process.chdir(workDir)`, so `--workDir` is broken     | `src/index.ts:24-33`, `src/rerun.ts:13`                 |
| `Logger.unindent()` discards `Math.max(...)` result                                                                                                    | `src/logger.ts:36`                                      |
| Rerun does `lastAnswer.answer \|\| undefined`: `false` and `0` answers are lost                                                                        | `src/prompts/index.ts:34`                               |
| Helper files inside a template (e.g. `scaffolding/conversion/helpers.js`) are scaffolded into the destination; only `scaffolding.config.*` is excluded | `src/templateProcessing/getTemplateFiles.ts:27`         |
| `variables(name, inputs)` receives `{variables, macros, ...answers}` so `inputs.variables` leaks and `inputs.NAME` does not exist                      | `src/userInputs/finalizeInputs.ts:68`                   |
| `getSearchQuestion` mutates the user's question object                                                                                                 | `src/prompts/search.ts:17-18`                           |
| `afterFileCreated` typed sync `string[]`, documented async/nullable, never awaited                                                                     | `src/types/index.ts:53`, `createFileFromTemplate.ts:78` |
| `scaffoldingPath` has a no-op `.replace(/\//g, '/')`                                                                                                   | `src/util.ts:50`                                        |
| README documents `maxDepth`; code uses `depthLimit`                                                                                                    | `README.md:411`, `src/types/index.ts:190`               |
| Publish workflow runs `npm run build` which does not exist                                                                                             | `.github/workflows/publish.yml`                         |

## Steps (each keeps the CLI working and is one commit/PR)

### 1. Harness first (no src changes)

- `npm ci`; set `engines.node >= 22.12`; `@types/node@22`.
- ESLint 9 flat config (`eslint.config.js`) porting the rules that matter from `.eslintrc` (prettier, import order, unused imports, no-console, max-params). Delete `.eslintrc`, `.eslintignore`.
- Replace jest + ts-jest with **vitest** (native ESM, no preset hack). Port `src/__tests__/util.test.ts`.
- Add `.github/workflows/ci.yml`: lint + `tsc --noEmit` + test on ubuntu and windows (author uses both). Fix `publish.yml` to `npm run build:all`.
- `git rm -r .idea`; add to `.gitignore`. Remove `glob` dep, `test:bn`/`test:debug` scripts (reference missing files), `x:prepare`, the `findLastIndex` polyfill.
- Reuse: keep `prettier.config.js`, `lint-staged.config.mjs`, husky.

### 2. Characterization test before touching src

- For each fixture template in `scaffolding/` (`component`, `conversion`, `typescript-component`), write a crafted `.template-scaffolder-last-run` into a temp copy of the repo and run the built CLI as a subprocess with `--rerun --dryRun`. Snapshot normalized stdout (pin `GIT_AUTHOR_NAME` so `USERNAME` is stable).
- Build with `npm run build:all` and assert `dist/index.d.ts` actually exists where `package.json#types` points (suspected dangling because `tsconfig.types.json` root widens through `userInputs/types`).
- These snapshots are the safety net for steps 3-8; they are deleted in step 9 once the in-process e2e suite covers the same ground.

### 3. Entry seam: `cli/main.ts` + `core/run.ts`

- Move all of `src/index.ts` into `run(options, deps)`; `main.ts` does `chdir(workDir)` **first**, then parses args, calls `run`, maps `ScaffolderError`/`UserCancelledError` to exit codes. This is the **only** file with `process.exit`.
- Add `core/errors.ts`; replace all 7 `process.exit` sites with thrown errors.
- Introduce `Prompter` and `Reporter` interfaces; CLI implementations wrap the existing `src/prompts/*` and `src/logger.ts` unchanged for now.
- Add the first in-process e2e test: `run()` with a scripted prompter against `scaffolding/typescript-component` into a temp dir, dryRun and real mode, asserting on files written.

### 4. One config shape: `core/config.ts`

- `normalizeConfig(raw)` canonicalizes value-or-function fields to functions, `destinations` to `string[]`, applies `createNameDir` default, maps `list`/`fuzzypath` with a warning, validates question shapes (hand-rolled, ~100 lines; zod is awkward for a config that is mostly functions). Returns `TemplateConfig | ConfigError[]`.
- Drop the `TInput` generic from all internal code. Keep it only on the public `IConfigFile<T>` and add `defineConfig<T>(cfg)` for inference in JS and TS configs.
- Type guards in `src/types/helpers.ts` become pure narrowing on `question.type`; validation moves into `normalizeConfig`.
- `hooks` object introduced here; `afterFileCreated` at top level is accepted and moved into `hooks` with a deprecation warning. Add `beforeRun(ctx)` and `afterRun(ctx, results)`.

### 5. Options and answers

- `core/options.ts`: `resolveCliOptions(argv, lastRun)` with **cli > lastRun**. Unit tests enumerate the precedence table.
- `core/answers.ts`: `collectAnswers(questions, prompter, priorAnswers)`; fixes `|| undefined` to `?? undefined`; `when` receives a typed answers object; never mutates questions.
- `core/context.ts`: `buildContext()` passes `{ name, answers, builtins }` to `variables()`/`macros()` so nothing leaks. Builtins: `NAME`, `TEMPLATE_NAME`, `TEMPLATE_VERSION`, `USERNAME` (reuse `getUserName` from `src/builtIns.ts`).
- `core/lastRun.ts` uses `projectRoot` from deps, not module-load cwd.

### 6. Pipeline core

- `core/plan.ts`: pure `planFiles()` that walks the template dir, applies `ignore` globs (default: `scaffolding.config.*`), substitutes variables in paths (reuse `transform` from `src/templateProcessing/transform.ts`, drop its top-level `await import`), and decides `write/overwrite/skip-exists`.
- `core/render.ts`: pure `renderFile()` from `getFileLines.ts` + `getFileContents.ts` (includes, stripLines, velocity).
- `core/process.ts`: `processFile()` → `FileResult`; messages collected as data, no `Logger`.
- `core/concurrency.ts`: `mapConcurrent()` replaces both serial/parallel `if` blocks.
- Delete `src/logger.ts` `Logger` class, `src/templateProcessing/*`, `src/userInputs/*`.
- `core/paths.ts`: single `toPosix()` replaces the scattered `replaceAll('\\','/')`.

### 7. Public API

- `src/index.ts` exports `scaffold(options, deps?)`, `defineConfig`, and all public types; zero side effects.
- `package.json`: add `main`/`exports` map, `types` pointing at the real emitted file, `bin` → `dist/cli/main.js`. Single `tsconfig.build.json` with `declaration: true`; delete `tsconfig.types.json`.
- Fixture configs import from the package name (`template-scaffolder`) via a `paths` alias instead of `../../src/types`.

### 8. Dependency swaps (each behind an interface, each reversible)

- `@inquirer/prompts` → 8 (2.3.16 already used 7). Port the `words` prompt from the 2.3.16 npm build into the CLI prompter.
- `node-cli-arg-by-config` → `node:util.parseArgs` in `cli/args.ts` with a hand-written help string (8 flags do not justify commander).
- `config-file-ts-async` → **jiti** behind `ConfigLoader`. Removes the `.template-scaffolder-ts-cache` dir and the custom tsconfig discovery. Verify against `scaffolding/tsconfig.json` (`module: CommonJS`) and a NodeNext variant.
- Add `checkbox` and `editor` prompt types here since `Prompter` now has one `ask()` seam — the first "richer prompts" feature.

### 9. Pluggable source readers: `template-scaffolder/source`

Goal: a template author reads declarations from TS, C#, or C++ with the same code, and adding another language is one small module.

- **Language-neutral model** (`src/source/model.ts`):
  ```ts
  interface SourceFile {
    path;
    language;
    types: TypeDecl[];
    functions: FunctionDecl[];
    namespaces: string[];
  }
  interface TypeDecl {
    name;
    kind: 'interface' | 'class' | 'struct' | 'enum' | 'record' | 'alias';
    namespace?;
    exported;
    bases: string[];
    fields: FieldDecl[];
    methods: FunctionDecl[];
    members?: EnumMember[];
    attributes: string[];
    doc?;
    text;
    raw: unknown;
  }
  interface FieldDecl {
    name;
    type: string;
    optional;
    static;
    access?;
    attributes: string[];
  }
  interface FunctionDecl {
    name;
    params: { name; type; optional; default? }[];
    returnType;
    async;
    static;
    access?;
    bodyText?;
    raw;
  }
  interface EnumMember {
    name;
    value?: string;
  }
  ```
  Types stay as source text (`'List<Order>'`, `'std::vector<int>'`, `'Foo | undefined'`). `raw` is the reader's native node and `text`/`bodyText` the exact source, the escape hatch for details like NSwag's `method: 'GET'`.
- **Query helpers** shared by every language: `file.type('BusinessRoles')`, `file.enum(…)`, `file.class(…)`, `file.find(pred)`, all throwing a clear "not found in <path>" error; `readSources(glob)` for many files.
- **Reader interface** (`src/source/reader.ts`):
  ```ts
  interface SourceReader {
    id: string;
    extensions: string[];
    read(path: string, text: string): Promise<SourceFile>;
  }
  export function defineSourceReader(r: SourceReader): SourceReader;
  ```
  A registry picks the reader by file extension; `readSource(path, { reader: 'csharp' })` forces one. Results are cached per run by absolute path.
- **Built-in readers**, each a subpath export so unused languages cost nothing:
  | Reader                                                                                                                                                                                                                                                                                                                                                           | Grammar (bundled `.wasm`)        |
  | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
  | `template-scaffolder/source/typescript` (`.ts .tsx .mts .cts .js .mjs .cjs`)                                                                                                                                                                                                                                                                                     | `tree-sitter-typescript` / `tsx` |
  | `template-scaffolder/source/csharp` (`.cs`)                                                                                                                                                                                                                                                                                                                      | `tree-sitter-c-sharp`            |
  | `template-scaffolder/source/cpp` (`.h .hpp .hh .cpp .cc .cxx`)                                                                                                                                                                                                                                                                                                   | `tree-sitter-cpp`                |
  | All run on `web-tree-sitter` (a regular dependency, no native build). Grammars are loaded lazily, so a run that reads no C# never loads the C# grammar. Custom readers can use tree-sitter through the exported `loadGrammar(wasmPath)` or any other parser.                                                                                                     |
  | Mapping notes: C# properties become fields, `record`/`struct` kinds kept, attributes captured, namespaces (file-scoped and block) recorded. C++ covers `class`/`struct`/`enum`/`enum class`, member functions, fields, access specifiers, namespaces; templates are kept as text and preprocessor macros are not expanded, which is documented as a known limit. |
- **Using them from a template**:
  - On every config context as `ctx.source` (`ctx.source.read(path)`, `ctx.source.readAll(glob)`), so `variables`/`prompts`/`macros` need no imports.
  - Directly importable in helper files (`import { readSource } from 'template-scaffolder/source'`), which is how BrewNinja's `_helpers` work today.
  - Custom readers: `readers: [myProtoReader]` in the config, or in a shared `scaffolding/scaffolder.config.ts` project file so all templates get them. A reader for a new language is ~50 lines; `docs/source-readers.md` walks through writing one with tree-sitter.
- **Type helpers** per language under `source/typescript` (`primaryType`, `unwrapPromise`, `unwrapArray`), `source/csharp` (`unwrapNullable`, `unwrapTask`, `elementType`), `source/cpp` (`stripQualifiers`, `elementType`).
- **Tests**: fixture files per language (NSwag-style TS client and enums, a C# controller/DTO/enum file with file-scoped namespace and records, a C++ header with namespaces, `enum class`, and a template class). One shared contract test suite runs against every reader so custom readers can reuse it via an exported `testSourceReader()` helper.
- **Acceptance check**: rewrite BrewNinja's `getInterfaces`, `getEndpoints`, `getEnumValues` on top of `readSource` in a scratchpad copy and confirm identical template output. Ship that rewrite as `docs/examples/api-client-reader.ts`, plus short C# and C++ examples.

### 10. Converter: `scaffolder migrate`

- New CLI subcommand in `src/migrate/`, parsing configs with the bundled tree-sitter TypeScript grammar, so it needs no `typescript` install. It edits files in place with minimal text edits, not a reprint, so formatting and comments survive.
- Scope: every `.ts/.mts/.cts/.js/.mjs/.cjs` under `scaffolding/`, including `_helpers`, not only `scaffolding.config.*`.
- Config objects are found by: default export, `as`/`satisfies`/annotation of `IConfigFile`, object returned from a function whose return type is `IConfigFile`, a `const` later default-exported. Spreads like `...getDefaultConfig()` are left alone because their source is converted where it is defined.
- Rewrites:
  | 2.x                                                                                                                               | 3.x                                                                                                        |
  | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
  | `from 'template-scaffolder/dist/types'` or `'.../src/types'`                                                                      | `from 'template-scaffolder'`                                                                               |
  | `variables: (name, inputs) => …`                                                                                                  | `variables: ({ name, answers: inputs }) => …` (body untouched)                                             |
  | `prompts: (name) => …`                                                                                                            | `prompts: ({ name }) => …`                                                                                 |
  | `macros: (name, inputs, vars) => …`                                                                                               | `macros: ({ name, answers: inputs, variables: vars }) => …`                                                |
  | `afterFileCreated: (p, d, v) => …`                                                                                                | `hooks: { afterFileCreated: ({ path: p, dryRun: d, variables: v }) => … }`                                 |
  | `afterFileCreated: formatFileCommand` (reference)                                                                                 | `hooks: { afterFileCreated: ({ path, dryRun, variables }) => formatFileCommand(path, dryRun, variables) }` |
  | `variables: someFn` (reference)                                                                                                   | wrapped the same way                                                                                       |
  | `destinations: 'literal'`                                                                                                         | `destination: 'literal'`                                                                                   |
  | `type: 'list'` / `'fuzzypath'`, `maxDepth`                                                                                        | `'select'` / `'path'`, `depthLimit`                                                                        |
  | `default export {…} as IConfigFile<T>`                                                                                            | left as is (type still exported); `defineConfig` is optional                                               |
  | Parameter type annotations move onto the destructured context, e.g. `({ name, answers: inputs }: VariablesContext<IUserInputs>)`. |
- Anything it cannot convert safely is reported as `file:line  reason` and left untouched. Exit code 1 if anything was reported.
- Flags: `--dryRun` prints a unified diff; refuses to run on a dirty git tree unless `--force`. After rewriting, it loads every config through `normalizeConfig` and reports validation errors.
- Prints follow-ups it does not do itself: delete `.template-scaffolder-ts-cache/` and its `.gitignore` line; 2.x `.template-scaffolder-last-run` files are read and upgraded automatically.
- Tests: a 2.x copy of this repo's three fixtures and a trimmed BrewNinja-shaped fixture, snapshot of migrated source, then a `run()` dryRun of migrated vs 2.x snapshot output must match.

### 11. Docs and release

- Regenerate README config reference from `core/types.ts` (fix `maxDepth`, remove `list`/`fuzzypath`/`separator`, document hooks, `ignore`, `words`, `CURRENT_FILE_PATH`, precedence, programmatic API, source readers).
- New `docs/source-readers.md`: the model, the three built-ins and their peer deps, `ctx.source` usage, and writing a custom reader.
- New `docs/migrating-to-v3.md`: what changed and why, running `npx scaffolder migrate --dryRun` then without, a before/after of a BrewNinja-style config, the manual checklist for anything the converter reports, and how to replace regex helpers with `template-scaffolder/source`. Linked from the README's top section.
- `CHANGELOG.md` with the v3 breaking list above, plus a 2.3.13–2.3.16 entry reconstructed from the npm diff.
- `package.json#files` allowlist (`dist`, `README.md`, `LICENSE`, `docs`): the 2.3.16 tarball leaked `.claude/settings.local.json` and `.template-scaffolder-last-run`. Remove `.npmignore`.
- Delete step-2 subprocess snapshots once in-process e2e covers all three fixtures.
- `npm version major` → 3.0.0. Publishing stays a manual step for you.

### 12. First feature on the new base

- `ignore` patterns in `TemplateConfig` (already plumbed in step 6), plus an `afterRun` hook example in `scaffolding/component` running prettier once on all files instead of once per file. Proves the seams work.

## Verification

- `npm run lint && npx tsc --noEmit && npm test` green on every step; CI runs it on ubuntu + windows.
- Step 2 snapshot tests stay green through steps 3-8 (only intentional diffs: precedence, hook await, parallel write order).
- In-process e2e (`src/__tests__/e2e/*.test.ts`): for each of the 3 fixtures, scripted prompter, temp destination, assert exact file set and contents; plus `--rerun`, `--overwrite` skip/overwrite, `--dryRun` writes nothing, `--workDir` resolves scaffolding and last-run relative to workDir, `ignore` excludes `helpers.js`, `false`/`0` answers survive rerun.
- Manual smoke after step 8: `npm run build:all && node dist/cli/main.js --dryRun` in this repo, select each template interactively; `npx scaffolder --help` prints the hand-written usage.
- **BrewNinja end-to-end** (in a scratchpad copy of `StrangeBrew.App`, never the original): record 2.3.16 `--dryRun` output for each of the 9 templates with a crafted last-run file, run `scaffolder migrate`, run v3 with the same answers, and diff. Expected differences: none, apart from `CURRENT_FILE_PATH` path normalisation if any.
- `npm pack --dry-run` shows `dist/`, `docs/`, `README.md`, `LICENSE` only; `node -e "import('template-scaffolder').then(m=>console.log(Object.keys(m)))"` lists `scaffold`, `defineConfig`.

## Progress log

| Step                                  | Status            | Notes                                                                                                                                                                                                                                                                                |
| ------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Harness                            | done              | ESLint 9 flat config, vitest 5, CI matrix (ubuntu/windows × Node 22/24), Node >= 22.12.                                                                                                                                                                                              |
| 2. Characterization                   | done              | Golden file trees captured from 2.3.12 for all three fixtures (`test/characterization`). A 2.x copy of the fixtures is kept in `test/fixtures/v2` for the converter.                                                                                                                 |
| 3–8. Core, CLI, API, dependency swaps | done (one commit) | Written directly against the new dependencies instead of wrapping the old code first, because the characterization tests already guard output. `config-file-ts-async` → jiti, `node-cli-arg-by-config` → `node:util.parseArgs`, inquirer 6 → 8, `words`/`checkbox`/`editor` prompts. |
| 9. Source readers                     | in progress       | Framework + TypeScript, C#, C++ readers on tree-sitter.                                                                                                                                                                                                                              |
| 10. Converter                         | todo              |                                                                                                                                                                                                                                                                                      |
| 11. Docs + release                    | todo              |                                                                                                                                                                                                                                                                                      |
| 12. `ignore` feature                  | done early        | Needed by the plan stage; `afterRun` example still to add.                                                                                                                                                                                                                           |

Also decided while implementing:

- **Characterization tests are kept** rather than deleted after step 9. They are the only tests of the built CLI end to end, and they are cheap.
- **The interactive prompter is tested** by driving the real inquirer prompts with simulated keystrokes (`createConsolePrompter({ input, output })`).
- **docs/examples are type-checked, linted and tested**, so the documentation cannot drift from the code.

Deviations from the plan, decided while implementing:

- **Hook commands still run concurrently with `--parallel`.** Writes are always sequential, but serialising every `npx prettier` call would throw away most of the `--parallel` speed-up BrewNinja relies on. The docs recommend `hooks.afterRun` for repo-wide commands such as `git add`, which avoids the index-lock race entirely.
- **Source readers are one subpath export** (`template-scaffolder/source`) with lazily loaded built-in readers, rather than one subpath per language. Unused grammars are still never loaded.
- **2.x bugs found while testing**, all fixed: the positional destination argument and `--destination` never worked (the arg parser rejected both); choosing "Other" in a destinations list produced the literal value `__other__` instead of asking for a path; `#include` cycles recursed forever.
