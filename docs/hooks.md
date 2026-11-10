[Docs](README.md) › Hooks

# Hooks

Hooks are functions in a config's `hooks` that run at fixed points. `afterFileCreated`
and `afterRun` can return shell commands to run, such as a formatter or `git add`.

```ts
hooks: {
  beforeRun: ({ answers }) => {
    if (answers.ROUTE && !answers.ROUTE.startsWith('/')) {
      throw new Error('The route must start with /');
    }
  },
  afterRun: ({ createdPaths, dryRun }) =>
    dryRun ? [] : [`npx prettier --write ${createdPaths.join(' ')}`],
},
```

| Hook                                    | Runs                                                     | Also receives                        | Returns         |
| --------------------------------------- | -------------------------------------------------------- | ------------------------------------ | --------------- |
| [`beforeRun`](#beforerun)               | Once, after the questions, before any file is generated. |                                      | nothing         |
| [`afterFileCreated`](#afterfilecreated) | After each file is written, or rendered in a dry run.    | `path`, `variables`                  | commands to run |
| [`afterRun`](#afterrun)                 | Once, after every file.                                  | `files`, `createdPaths`, `variables` | commands to run |

Every hook receives one context object with:

| Property      | Value                                                                 |
| ------------- | --------------------------------------------------------------------- |
| `name`        | The name entered by the user.                                         |
| `answers`     | The answers, by question name.                                        |
| `builtins`    | `{ NAME, TEMPLATE_NAME, TEMPLATE_VERSION, USERNAME }`.                |
| `source`      | Reads your source code. See [Reading source code](source-readers.md). |
| `destination` | The destination folder, relative to the project root.                 |
| `dryRun`      | Whether this is a dry run.                                            |

Hooks may be async.

## Commands

A hook that runs commands returns an array of strings (or nothing, `null` or `[]`).
Each command:

- runs in the project root, through the system shell;
- runs after the previous one finishes, and the rest still run if one fails;
- is listed as `would run: ...` in a dry run, and not run;
- has its output shown if it fails, or always with `--debug`.

A failed command makes the run exit with code 1.

```text
  created  src/pages/Tank/ListTanks.tsx
    $ npx prettier --write src/pages/Tank/ListTanks.tsx
  created  src/pages/Tank/EditTank.tsx
    $ npx prettier --write src/pages/Tank/EditTank.tsx (exit 2)
      [error] src/pages/Tank/EditTank.tsx: SyntaxError: Unexpected token (14:3)
```

Quote paths if your folders can contain spaces:

```ts
afterRun: ({ createdPaths }) => [
  `npx prettier --write ${createdPaths.map(p => JSON.stringify(p)).join(' ')}`,
],
```

## beforeRun

Runs once the questions are answered and the destination is chosen. Use it to check
answers or prepare something. Throw to stop the run before anything is written: the
error's message is shown, prefixed with the hook's name.

```text
$ npx scaffolder --template=page --name=Tank
hooks.beforeRun: src/data/api/tanks.ts has no API client in it.
```

```ts
beforeRun: async ({ answers, source }) => {
  const client = await source.read(answers.API_CLIENT);
  if (client.types.length === 0) {
    throw new Error(`${answers.API_CLIENT} has no API client in it.`);
  }
},
```

## afterFileCreated

Runs for each file that was created or overwritten (not for skipped files). `path` is
relative to the project root.

```ts
afterFileCreated: ({ path, dryRun }) =>
  dryRun ? [] : [`npx eslint --fix ${path}`],
```

With `--parallel`, the commands for different files run at the same time. That is
fine for formatters, but not for commands that share state, like `git add`, which
fails when two run at once. Use `afterRun` for those.

## afterRun

Runs once, after every file is done. One command for all files is usually much faster
than one per file.

```ts
afterRun: ({ createdPaths, dryRun }) =>
  dryRun || createdPaths.length === 0
    ? []
    : [
        `npx prettier --write ${createdPaths.join(' ')}`,
        `git add ${createdPaths.join(' ')}`,
      ],
```

| Property       | Value                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `createdPaths` | Paths of the files created or overwritten, relative to the project root.                                                                    |
| `files`        | Every file's result: `{ path, status, reason?, warnings, content?, commands }`. `status` is `created`, `overwritten`, `skipped` or `error`. |
| `variables`    | Every variable the templates saw.                                                                                                           |

An error thrown by `afterRun` is reported like one from `beforeRun`, after the files
are written.

`afterRun` also runs in a dry run (with `dryRun: true`), so it can print a summary.

## Sharing hooks

Put hooks in a [shared default config](configuration.md#sharing-config-between-templates)
and spread it into each template's config.
