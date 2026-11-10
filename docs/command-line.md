[Docs](README.md) › Command line

# Command line

```text
scaffolder [destination] [options]     generate files from a template
scaffolder migrate [folder] [options]  convert 2.x template configs to 3.x
```

Run it with `npx scaffolder`, or from a `package.json` script. Anything not given on
the command line is asked for.

## Options

| Option                             | Meaning                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `--template <name>`                | Template folder name, or the `name` in its config.                           |
| `--name <name>`                    | The name, available to templates as `NAME`.                                  |
| `--destination <dir>`              | Output folder, relative to the project root. Can also be the first argument. |
| `--dryRun`                         | Print the generated files instead of writing them. Runs no commands.         |
| `--overwrite`                      | Replace files that already exist. By default they are skipped.               |
| `--parallel`                       | Load configs, render files and run per-file hook commands concurrently.      |
| `--rerun`                          | Replay the previous run's template, name, destination and answers.           |
| `--workDir <dir>`                  | Run as if started in `<dir>`.                                                |
| `--debug`                          | Show variables, skipped questions and command output. `DEBUG=true` too.      |
| `-h`, `--help` / `-v`, `--version` | Help and version.                                                            |

Flags can also be written in kebab case (`--dry-run`) and, as in 2.x, as
`--dryRun=true`. Unknown flags are an error.

## How each value is chosen

**Template.** `--template` matches a folder in `scaffolding/` first, then a config's
`name`. Without it you pick from a list of every template. A template whose config
fails to load is left out of the list with a warning.

**Name.** `--name`, or asked for.

**Destination**, the first that applies:

1. `--destination`, or the first argument.
2. The config's `destination`. The user is not asked.
3. The config's `destinations`, offered as a list. Only folders that exist are listed,
   plus "Other", which opens a folder picker.
4. A folder picker starting at the config's `srcRoot`, or `./src` if it exists, or
   the project root.

The destination must be an existing folder. Files go into a subfolder named after the
name, unless the config sets `createNameDir: false`.

**Answers.** Each question in the config's `prompts` is asked, in order, unless its
`when` returns false.

## Existing files

Existing files are skipped and reported:

```text
  skipped  src/components/SaveButton/SaveButton.tsx: already exists (use --overwrite)
  created  src/components/SaveButton/SaveButton.stories.tsx
```

`--overwrite` replaces them.

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

`--parallel` loads template configs, renders files, and runs each file's
`afterFileCreated` commands concurrently, up to the number of CPU cores. Output is
still reported in template order, and files are always written one at a time.

It helps most when an `afterFileCreated` hook runs a slow command for every file.
Running one command for all files from [`afterRun`](hooks.md#afterrun) is usually
faster still.

## Exit codes

| Code  | Meaning                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------- |
| `0`   | Success.                                                                                           |
| `1`   | A file failed to render or write, a hook command failed, or the template or its config is invalid. |
| `2`   | Bad command-line arguments.                                                                        |
| `130` | Cancelled with Ctrl-C.                                                                             |

## Migrate

`scaffolder migrate [folder]` converts 2.x configs to 3.x. `folder` defaults to
`scaffolding`.

| Option     | Meaning                                                                       |
| ---------- | ----------------------------------------------------------------------------- |
| `--dryRun` | Print the changes as a diff. Writes nothing.                                  |
| `--force`  | Run even if the folder has uncommitted changes or is not in a git repository. |

See [Migrating to v3](migrating-to-v3.md).
