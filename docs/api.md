[Docs](README.md) › Programmatic API

# Programmatic API

Run templates from your own scripts, tools and tests with `scaffold()`. It does
everything the command line does, without asking questions unless you want it to.

```ts
import { scaffold } from 'template-scaffolder';

const result = await scaffold({
  projectRoot: '/path/to/project',
  template: 'component',
  name: 'Button',
  destination: 'src/components',
  answers: { WITH_TESTS: true },
});

for (const file of result.files) console.log(file.status, file.path);
if (result.hasErrors) process.exitCode = 1;
```

Importing `template-scaffolder` has no side effects.

## Options

| Option        | Default                   | Description                                              |
| ------------- | ------------------------- | -------------------------------------------------------- |
| `projectRoot` | `process.cwd()`           | The folder containing `scaffolding/`.                    |
| `template`    | asked                     | Template folder name, or the `name` in its config.       |
| `name`        | asked                     | The `NAME` variable.                                     |
| `destination` | from the config, or asked | Output folder, relative to `projectRoot`.                |
| `answers`     | `{}`                      | Answers by question name. These questions are not asked. |
| `dryRun`      | `false`                   | Render without writing files or running commands.        |
| `overwrite`   | `false`                   | Replace existing files.                                  |
| `parallel`    | `false`                   | As `--parallel`.                                         |
| `rerun`       | `false`                   | Replay the last run saved in `projectRoot`.              |
| `prompter`    | answers only              | How questions are asked. See below.                      |
| `reporter`    | silent                    | Where progress goes. See below.                          |

## Answering questions

By default nothing is asked. Each question gets its answer from `answers`, or its
`default`. A question with neither gets `false` (`confirm`), `[]` (`checkbox` and
`words`) or `undefined` (the rest). `required` and `select` questions fail with a
`MISSING_ANSWER` error instead. The template, name and destination must be given, or come
from the config.

To ask in the terminal, as the CLI does:

```ts
import { createConsolePrompter, scaffold } from 'template-scaffolder';

await scaffold({ template: 'component', prompter: createConsolePrompter() });
```

Or ask some other way by implementing `IPrompter`:

```ts
import type { IPrompter } from 'template-scaffolder';

const prompter: IPrompter = {
  async ask(question) {
    // question.type, question.name, question.message, question.choices...
    return myUi.ask(question);
  },
};
```

`createAnswerPrompter(answers)` is the default prompter; wrap it to fall back to
something else.

## Progress

By default `scaffold()` prints nothing. `createConsoleReporter({ debug: false })`
prints what the CLI prints. Or implement `IReporter`:

```ts
const reporter: IReporter = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: () => {},
  file: result => console.log(`${result.status} ${result.path}`),
};
```

## The result

| Property           | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| `files`            | One entry per template file, in template order.                       |
| `hasErrors`        | True if a file failed to render or write, or a hook command failed.   |
| `template`         | The template folder.                                                  |
| `name`             | The name.                                                             |
| `destination`      | The destination folder.                                               |
| `answers`          | Every answer.                                                         |
| `variables`        | Every variable the templates saw.                                     |
| `afterRunCommands` | Commands from `hooks.afterRun`, with `{ command, exitCode, output }`. |

Each entry in `files`:

| Property       | Value                                                                   |
| -------------- | ----------------------------------------------------------------------- |
| `path`         | Output path, relative to the project root.                              |
| `templateFile` | The template file, relative to the template folder.                     |
| `status`       | `created`, `overwritten`, `skipped` or `error`.                         |
| `reason`       | Why it was skipped or failed.                                           |
| `content`      | The rendered content (also in a dry run).                               |
| `commands`     | Commands from `afterFileCreated`, with `{ command, exitCode, output }`. |

## Errors

Problems that stop a run, like a missing template or an invalid config, throw a
`ScaffolderError`. Its `code` says what went wrong, and `details` lists individual
problems (such as every invalid question in a config).

| `code`                   | When                                                      |
| ------------------------ | --------------------------------------------------------- |
| `NO_SCAFFOLDING`         | There is no `scaffolding` folder, or it has no templates. |
| `TEMPLATE_NOT_FOUND`     | No template matches `template`.                           |
| `CONFIG_NOT_FOUND`       | The template folder has no config file.                   |
| `CONFIG_LOAD_FAILED`     | The config file threw or could not be parsed.             |
| `CONFIG_INVALID`         | The config or its questions are invalid.                  |
| `CONFIG_FUNCTION_FAILED` | `prompts`, `variables` or `macros` threw.                 |
| `DESTINATION_INVALID`    | The destination is not an existing folder.                |
| `MISSING_ANSWER`         | A question has no answer (see above).                     |
| `LAST_RUN_MISSING`       | `rerun` with no saved run.                                |
| `LAST_RUN_INVALID`       | The saved run could not be read.                          |
| `SOURCE_READ_FAILED`     | A source reader could not read a file.                    |
| `CANCELLED`              | The user pressed Ctrl-C (a `UserCancelledError`).         |

```ts
import { ScaffolderError, scaffold } from 'template-scaffolder';

try {
  await scaffold({ template: 'component', name: 'Button' });
} catch (e) {
  if (e instanceof ScaffolderError && e.code === 'MISSING_ANSWER') {
    // ...
  }
  throw e;
}
```

Errors thrown by your own hooks (`beforeRun` and `afterRun`) are passed through
unchanged. A file that fails to render does not throw: it has `status: 'error'`, and
`hasErrors` is true. So does a file whose `afterFileCreated` hook throws.

## Testing your templates

`scaffold()` with `dryRun: true` makes it easy to test templates in your own test
suite, without writing files:

```ts
import { expect, it } from 'vitest';
import { scaffold } from 'template-scaffolder';

it('generates a list page', async () => {
  const result = await scaffold({
    template: 'page',
    name: 'Tank',
    destination: 'src/pages',
    answers: { PLURAL_NAME: 'Tanks', WITH_TESTS: false },
    dryRun: true,
  });
  expect(result.hasErrors).toBe(false);
  expect(result.files.map(f => f.path)).toEqual([
    'src/pages/Tank/ListTanks.tsx',
  ]);
  expect(result.files[0].content).toMatchSnapshot();
});
```

A dry run still saves the answers to `.template-scaffolder-last-run`, as on the
command line.
