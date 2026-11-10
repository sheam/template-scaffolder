[Docs](README.md) › Migrating to v3

# Migrating from 2.x to 3.x

Version 3 is a rewrite of the scaffolder's internals. Your templates (the files with
`${NAME}` in them) do not change. Your `scaffolding.config.*` files change shape in a
few mechanical ways, and a converter makes those changes for you.

## The short version

Use Node.js 22.12 or later, and commit your `scaffolding` folder first.

```sh
npm install --save-dev template-scaffolder@3
npx scaffolder migrate --dryRun     # review the changes as a diff
npx scaffolder migrate              # apply them
npx scaffolder --dryRun             # try a template
git diff                            # review, then commit
```

Then delete the `.template-scaffolder-ts-cache` folder and its line in `.gitignore`.
The converter reminds you if they are there.

To convert before upgrading the dependency, run the converter straight from npm with
`npx template-scaffolder@3 migrate`. The package is `template-scaffolder`. Its command
is `scaffolder`. Do not run `npx scaffolder@3`: it downloads a different package
that happens to be called `scaffolder`.

## What the converter does

`scaffolder migrate [folder]` looks at every `scaffolding.config.*` file and every
script in a folder starting with `_` (such as `_helpers`), except `_includes`, which
holds templates. It never touches template files.

It edits the text in place, so your formatting and comments stay. Running it twice
changes nothing the second time.

| 2.x                                                            | 3.x                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `import { IConfigFile } from 'template-scaffolder/dist/types'` | `import { IConfigFile } from 'template-scaffolder'`                                  |
| `variables: (name, inputs) => ...`                             | `variables: ({ name, answers: inputs }) => ...`                                      |
| `prompts: (name) => ...`                                       | `prompts: ({ name }) => ...`                                                         |
| `macros: (name, inputs, variables) => ...`                     | `macros: ({ name, answers: inputs, variables }) => ...`                              |
| `afterFileCreated: (path, dryRun, vars) => ...`                | `hooks: { afterFileCreated: ({ path, dryRun, variables: vars }) => ... }`            |
| `afterFileCreated: formatFileCommand`                          | `hooks: { afterFileCreated: ({ path, dryRun }) => formatFileCommand(path, dryRun) }` |
| `destinations: './src'` (a single string)                      | `destination: './src'`                                                               |
| `type: 'list'` / `type: 'fuzzypath'`                           | `type: 'select'` / `type: 'path'`                                                    |
| `maxDepth: 2`                                                  | `depthLimit: 2`                                                                      |
| A helper file next to the config, e.g. `conversion/helpers.js` | `ignore: ['helpers.js']` is added (see below)                                        |

Function bodies are not changed. Parameters keep their local names, so `inputs.FOO`
still works. When parameters had types, the type moves onto the context:

```ts
// before
variables: async (name: string, inputs: IUserInputs) => ({ ... }),
// after
variables: async ({ name, answers: inputs }: IVariablesContext<IUserInputs>) => ({ ... }),
```

and `IVariablesContext` is added to your `template-scaffolder` import.

The converter finds config objects wherever they are defined: a default export, a
`const` that is later exported, `module.exports`, an object marked `as IConfigFile` or
`satisfies IConfigFile`, or one returned from a function declared to return
`IConfigFile`. That last case covers shared defaults such as:

```ts
// scaffolding/_helpers/defaultConfig.ts
export function getDefaultConfig<T extends object>(): IConfigFile<T> {
  return {
    hooks: {
      afterFileCreated: ({ path, dryRun }) => formatFileCommand(path, dryRun),
    },
    stripLines: [/\/\/\s*STRIP\b/],
    macros: { lowerFirst, upperFirst },
  };
}
```

Configs that spread those defaults (`...getDefaultConfig()`) need no change.

### Options

| Option     | Meaning                                                                       |
| ---------- | ----------------------------------------------------------------------------- |
| `[folder]` | Folder to convert. Default `scaffolding`.                                     |
| `--dryRun` | Print a diff of every change. Writes nothing.                                 |
| `--force`  | Run even if the folder has uncommitted changes or is not in a git repository. |

Without `--force`, the converter refuses to run unless the folder is committed, so you
can always review the result with `git diff` and undo it with `git checkout`.

After converting, it loads every config the way a real run would and reports anything
v3 still objects to.

### What it cannot convert

These are reported as `file:line  reason` and left alone. Fix them by hand:

- A config function that uses `arguments`.
- `prompts`, `variables` or `macros` set to the result of a call (`macros: makeMacros()`).
  If that call returns a function, change the function to take the context object.
- A config that has both a top-level `afterFileCreated` and a `hooks` object.
- A method-style `afterFileCreated(path) { ... }`. Move it into `hooks`.

If you skip the converter, v3 still runs most 2.x configs. Top-level
`afterFileCreated`, `destinations` as a string, `list`/`fuzzypath` and `maxDepth`
work with a deprecation warning. Functions with two or more positional parameters are
rejected with a message telling you to run `scaffolder migrate`. A one-parameter
`variables: name => ...` cannot be told apart from the new form, so it receives the
context object; if that breaks, the error message points here too.

## Behaviour changes to know about

**Helper files are no longer copied into the output.** 2.x generated every file in a
template folder except the config, so a `helpers.js` imported by the config ended up in
your source tree. The converter adds such files to the new `ignore` list. Add other
non-template files to `ignore` yourself.

**Failures are no longer silent.** In 2.x, a template file that failed to render was
logged and skipped, and the run still exited with code 0. v3 skips it too, but prints
`failed <path>: <reason>` and exits with code 1. If your templates have files that
quietly never rendered, you will now see them.

**Type errors in configs no longer block a template.** 2.x type-checked TypeScript
configs before running them and gave up on any error. v3 strips the types and runs the
code. Use your editor or `tsc` for type checking.

**`--rerun` lets you override replayed values.** In 2.x, `--rerun --name=Other` ignored
`--name`. In v3, options given on the command line win over the replayed ones. 2.x
`.template-scaffolder-last-run` files are still read.

**The destination can be given on the command line.** The positional destination
argument and `--destination` were documented in 2.x but rejected. They work now.

**`afterFileCreated` is awaited**, and it can return nothing, `null` or a list of
commands. With `--parallel`, the commands for different files still run concurrently.
Writing files is always sequential.

**`--parallel` only affects hook commands.** Loading configs and rendering files is
always concurrent now; it has no visible effect except speed.

**Unknown variables are reported.** A template that uses a variable that does not
exist still generates the same output (the `$NAME` as written), with a warning naming
the variable. Converted 2.x templates often show a few. Fix the real ones, and
escape intended `$` signs as `\$`.

**A missing destination is offered for creation**, instead of stopping the run.

**Replayed answers are checked.** If a `--rerun` answer is no longer one of a
question's choices, the run stops and says so. Run once without `--rerun` to answer
again.

**Choosing "Other" in a destinations list asks for a path.** In 2.x it tried to use
the literal value `__other__`.

**Command-line flags.** `--dryRun=true` style flags still work. Unknown flags are now an
error (exit code 2) instead of being ignored.

**Node.js 22.12 or later** is required.

## New in 3.x

- `hooks.beforeRun` and `hooks.afterRun`. `afterRun` gets every created path, so you
  can run `prettier` or `git add` once instead of once per file. Every hook gets the
  name, answers, source readers and destination.
- `strictVariables` and `keepLineBreaks` config options. See
  [Configuration](configuration.md#strictvariables).
- `--answer KEY=value` and `--answers file.json`, to run templates without prompts.
- `scaffolder init` and `scaffolder list`.
- `ignore` globs.
- `checkbox` and `editor` questions (and `words`, added in 2.3.13).
- `CURRENT_FILE_PATH` variable (added in 2.3.15).
- Source readers for TypeScript, C# and C++: `ctx.source.read(path)` in configs, or
  `readSource` from `template-scaffolder/source` in helpers. See
  [Source readers](source-readers.md). If your helpers parse code with regular
  expressions, [`examples/api-client-reader.ts`](examples/api-client-reader.ts) shows
  the same job done with a reader.
- `defineConfig()` for type checking and completion in JS and TS configs.
- A programmatic API: `scaffold({ template, name, destination, answers })` and
  `listTemplates()`.
- Config files that import `template-scaffolder` always get the running version, even
  under `npx` without a local install.

## Checking the result

The safest check is to generate with both versions and compare. Capture the 2.x
output before you upgrade:

```sh
npx scaffolder --template=my-template --name=Test --dryRun > before.txt   # still on 2.x
npm install --save-dev template-scaffolder@3
npx scaffolder migrate
npx scaffolder --template=my-template --name=Test --dryRun > after.txt
```

Answer the questions the same way both times and compare the file contents in the two
outputs. v3 also reads the 2.x `.template-scaffolder-last-run` file, so for the second
run you can use `--rerun --dryRun` instead. The 3.x dry-run output prints each file
between the same `⌄⌄⌄ path ⌄⌄⌄` and `⌃⌃⌃` markers as 2.x, without the extra indentation
and the configuration dump.
