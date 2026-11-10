[Docs](README.md) › Command line

# Command line

```text
scaffolder [destination] [options]     generate files from a template
scaffolder init [options]              create a scaffolding folder with an example template
scaffolder list [options]              list the templates
scaffolder migrate [folder] [options]  convert 2.x template configs to 3.x
```

Run it with `npx scaffolder`, or from a `package.json` script. Anything not given on
the command line is asked for.

## Options

| Option                  | Meaning                                                                      |
| ----------------------- | ---------------------------------------------------------------------------- |
| `--template <name>`     | Template folder name, or the `name` in its config.                           |
| `--name <name>`         | The name, available to templates as `NAME`.                                  |
| `--destination <dir>`   | Output folder, relative to the project root. Can also be the first argument. |
| `--answer <KEY=value>`  | Answer a question. Repeat for more answers.                                  |
| `--answers <file.json>` | Answer questions from a JSON file.                                           |
| `--dryRun`              | Print the generated files instead of writing them. Runs no commands.         |
| `--overwrite`           | Replace files that already exist. By default they are skipped.               |
| `--parallel`            | Run each file's `afterFileCreated` commands concurrently.                    |
| `--rerun`               | Replay the previous run's template, name, destination and answers.           |

These work with every command:

| Option                             | Meaning                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| `--workDir <dir>`                  | Run as if started in `<dir>`.                                                         |
| `--debug`                          | Show variables, skipped questions, command output and stack traces. `DEBUG=true` too. |
| `-h`, `--help` / `-v`, `--version` | Help and version.                                                                     |

Flags can also be written in kebab case (`--dry-run`) and, as in 2.x, as
`--dryRun=true`. Unknown flags, and flags that do not apply to the command, are an
error.

## How each value is chosen

**Template.** `--template` matches a folder in `scaffolding/` first, then a config's
`name`. Without it you pick from a list of every template. A template whose config
fails to load is left out of the list with a warning.

**Name.** `--name`, or asked for.

**Destination**, the first that applies:

1. `--destination`, or the first argument.
2. The config's `destination`. The user is not asked.
3. The config's `destinations`, offered as a list. Folders that do not exist yet are
   marked `(new)`. "Other" opens a folder picker.
4. A folder picker starting at the config's `srcRoot`, or `./src` if it exists, or
   the project root.

If the destination does not exist, you are asked whether to create it
(`--answer createDestination=yes` answers in advance). In a dry run it is not
created. Files go into a subfolder named after the name, unless the config
sets `createNameDir: false`.

**Answers.** Each question in the config's `prompts` is asked, in order, unless its
`when` returns false or it already has an answer from `--answer`, `--answers` or
`--rerun`.

## Answering questions in advance

To run a template without being asked anything, for example from a script, give the
template, name and destination, and answer every question:

```sh
npx scaffolder src/pages --template=page --name=Tank \
  --answer PLURAL_NAME=Tanks --answer WITH_TESTS=yes --answer FEATURES=list,edit
```

Answers are converted to the question's type:

| Question type | Write                                                       |
| ------------- | ----------------------------------------------------------- |
| `confirm`     | `yes`, `no`, `true`, `false`, `y`, `n`, `1` or `0`          |
| `number`      | a number, within `min` and `max`                            |
| `words`       | words separated by spaces, or by the question's `separator` |
| `checkbox`    | values separated by commas                                  |
| `select`      | one of the choices' values                                  |
| others        | the text as is                                              |

An answer that does not fit, such as `maybe` for a `confirm` or a value that is not
one of a `select`'s choices, stops the run with a message saying what was expected.

For many answers, put them in a JSON file and pass `--answers answers.json`:

```json
{
  "PLURAL_NAME": "Tanks",
  "WITH_TESTS": true,
  "FEATURES": ["list", "edit"]
}
```

`--answer` wins over `--answers` for the same question.

## Existing files

Existing files are skipped and reported:

```text
  skipped  src/components/SaveButton/SaveButton.tsx: already exists (use --overwrite)
  created  src/components/SaveButton/SaveButton.stories.tsx
```

`--overwrite` replaces them.

## Warnings

A file that uses a variable that does not exist is still generated, with a warning,
because Velocity outputs an unknown `$NAME` as written:

```text
  created  src/pages/Tank/ListTanks.tsx
    warning: unknown variable $PLURAL_NMAE (escape a literal $ as \$)
```

`${...}` inside backticks is not reported, because in JavaScript and TypeScript that
is a template literal meant for the output. Set
[`strictVariables`](configuration.md#strictvariables) to make unknown variables fail
the file instead.

## Dry runs

`--dryRun` renders everything and prints each file between markers. Nothing is
written, and hook commands are listed but not run. When rerunning, the saved answers
are printed first.

```text
$ npx scaffolder --rerun --dryRun --name=TankList
replaying the previous run of 'component'
Add a test? true
Styling: css
⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄ src/pages/TankList/TankList.tsx ⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄⌄
import './TankList.css';

export const TankList = () => <div data-testid="tank-list" />;

⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃⌃

    would run: npx prettier --write src/pages/TankList/TankList.tsx
Dry run: would create 1 of 1 files in 0.09s.
```

Files that already exist are listed as `skipped`, as in a real run, so add
`--overwrite` to see them.

## Re-running

Every run saves its template, name, destination and answers to
`.template-scaffolder-last-run` in the project root. `--rerun` replays them without
asking anything. This is the quickest way to work on a template:

```sh
npx scaffolder                        # answer the questions once
# edit the template...
npx scaffolder --rerun --dryRun       # look at the output
npx scaffolder --rerun --overwrite    # write it
```

Options given with `--rerun` win over the saved ones, so
`scaffolder --rerun --name=Other` replays everything except the name. A rerun does
not save over the last-run file. Questions added to the template since the last run
are asked.

## Speed

Template configs are loaded, and files rendered, concurrently. Files are always
written one at a time, and results are reported in template order.

`--parallel` also runs each file's `afterFileCreated` commands concurrently, up to the
number of CPU cores. It helps when such a hook runs a slow command for every file,
but commands that share state, like `git add`, can fail when run at the same time.
Running one command for all files from [`afterRun`](hooks.md#afterrun) is usually
faster still, and safe.

## Exit codes

| Code  | Meaning                                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------- |
| `0`   | Success.                                                                                                          |
| `1`   | A file failed to render or write, a hook failed, an answer was invalid, or the template or its config is invalid. |
| `2`   | Bad command-line arguments.                                                                                       |
| `130` | Cancelled with Ctrl-C.                                                                                            |

## init

`scaffolder init` creates a `scaffolding` folder with a working example template, a
shared include and a `tsconfig.json` for editor support, and adds
`.template-scaffolder-last-run` to `.gitignore` if there is one. It does nothing if
`scaffolding` already has templates. `--dryRun` lists what it would create.

```text
$ npx scaffolder init
  created  scaffolding/tsconfig.json
  created  scaffolding/_includes/fileHeader.txt
  created  scaffolding/example/scaffolding.config.ts
  created  scaffolding/example/${NAME}.ts
  updated  .gitignore (add .template-scaffolder-last-run)
```

## list

`scaffolder list` prints each template's folder, name and description. `--json`
prints them as JSON, for scripts:

```text
$ npx scaffolder list
component  React component - A component with a test
page       Page
```

## migrate

`scaffolder migrate [folder]` converts 2.x configs to 3.x. `folder` defaults to
`scaffolding`.

| Option     | Meaning                                                                       |
| ---------- | ----------------------------------------------------------------------------- |
| `--dryRun` | Print the changes as a diff. Writes nothing.                                  |
| `--force`  | Run even if the folder has uncommitted changes or is not in a git repository. |

See [Migrating to v3](migrating-to-v3.md).

The words `init`, `list` and `migrate` are commands, so to generate into a folder with
one of those names, use `--destination`.
