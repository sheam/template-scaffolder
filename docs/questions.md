[Docs](README.md) › Questions

# Questions

A template's `prompts` lists the questions to ask. Each answer becomes a template
variable named after the question, and is passed to `variables`, `macros` and
`hooks.beforeRun` as `answers`.

```ts
prompts: [
  { name: 'TITLE', message: 'Page title:' },
  { name: 'WITH_TESTS', type: 'confirm', message: 'Add tests?', default: true },
],
```

`prompts` can also be a function, which is useful when the choices come from your
code:

```ts
prompts: async ({ name, source }) => [
  { name: 'TITLE', message: 'Page title:', default: name },
  {
    name: 'ROLE',
    type: 'search',
    message: 'Role required to view the page:',
    choices: (await source.read('src/enums.ts'))
      .enum('BusinessRoles')
      .members.map(m => ({ value: m.name })),
  },
],
```

## Fields every question has

| Field      | Description                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------- |
| `name`     | The variable that receives the answer. Must be unique in the template.                        |
| `message`  | The text shown to the user.                                                                   |
| `type`     | One of the types below. Default `input`.                                                      |
| `required` | Do not accept an empty answer.                                                                |
| `when`     | `(answersSoFar) => boolean`. Return false to skip the question; its answer is then undefined. |

```ts
{
  name: 'ROUTE',
  message: 'Route:',
  when: answers => answers.TYPE === 'page',
}
```

## Types

| `type`                  | Answer     | Fields                                                                             |
| ----------------------- | ---------- | ---------------------------------------------------------------------------------- |
| [`input`](#input)       | `string`   | `default`                                                                          |
| [`words`](#words)       | `string[]` | `separator`, `default`                                                             |
| [`number`](#number)     | `number`   | `default`, `min`, `max`                                                            |
| [`confirm`](#confirm)   | `boolean`  | `default`                                                                          |
| [`select`](#select)     | `string`   | `choices`, `default`                                                               |
| [`search`](#search)     | `string`   | `choices` or `source`, `default`                                                   |
| [`checkbox`](#checkbox) | `string[]` | `choices`, `default`                                                               |
| [`path`](#path)         | `string`   | `rootPath`, `itemType`, `depthLimit`, `excludePath`, `allowManualInput`, `default` |
| [`editor`](#editor)     | `string`   | `default`, `postfix`                                                               |

### input

Free text.

```ts
{ name: 'TITLE', message: 'Page title:', default: 'New page', required: true }
```

### words

Free text split into a list, on whitespace or on `separator`.

```ts
{ name: 'FIELDS', type: 'words', message: 'Field names (space separated):' }
// "id name createdAt" -> ['id', 'name', 'createdAt']

{ name: 'LABELS', type: 'words', message: 'Labels (comma separated):', separator: ',' }
// "Save, Save and close" -> ['Save', 'Save and close']
```

```text
#foreach($field in $FIELDS)
  $field: string;
#end
```

### number

```ts
{ name: 'PAGE_SIZE', type: 'number', message: 'Page size:', default: 25, min: 1, max: 500 }
```

### confirm

Yes or no.

```ts
{ name: 'WITH_TESTS', type: 'confirm', message: 'Add tests?', default: true }
```

```text
#if($WITH_TESTS)
import { render } from '@testing-library/react';
#end
```

### select

Pick one from a list. The answer is the choice's `value`.

```ts
{
  name: 'STYLE',
  type: 'select',
  message: 'Styling:',
  choices: [
    { value: 'css', name: 'CSS module' },
    { value: 'tailwind', name: 'Tailwind', description: 'Utility classes' },
    { value: 'none', name: 'None' },
  ],
  default: 'css',
}
```

A choice is `{ value, name?, description?, disabled? }`. `name` is what is shown,
and defaults to `value`. A `disabled` choice is shown but cannot be picked.

### search

Like `select`, but the user types to filter. Good for long lists. Typing several
words matches choices containing all of them.

```ts
{ name: 'ENTITY', type: 'search', message: 'Entity:', choices: entities }
```

Instead of `choices`, give `source`, a function called with what the user has typed
(or `undefined` before they type) that returns the choices, for lists that are
expensive to build or that come from elsewhere:

```ts
{
  name: 'PACKAGE',
  type: 'search',
  message: 'Package:',
  source: async term =>
    (await listPackages()).filter(p => !term || p.includes(term)).map(p => ({ value: p })),
}
```

### checkbox

Pick any number from a list. Set `checked: true` on a choice, or list values in
`default`, to start with it selected.

```ts
{
  name: 'FEATURES',
  type: 'checkbox',
  message: 'Include:',
  choices: [
    { value: 'list', checked: true },
    { value: 'edit' },
    { value: 'delete' },
  ],
}
```

```text
#if($FEATURES.includes('edit'))
export const Edit${NAME} = () => { /* ... */ };
#end
```

### path

Pick a file or folder in the project. The user types to filter: one word matches
anywhere in the path, and several words match the start of path segments or
camelCase words in order, so `al qu` finds `alerts/QueryAlert.tsx`.

```ts
{
  name: 'API_CLIENT',
  type: 'path',
  message: 'API client:',
  rootPath: 'src/data/api',
  itemType: 'file',
  depthLimit: 2,
  excludePath: info => info.name.endsWith('.test.ts'),
}
```

| Field              | Default      | Description                                                                               |
| ------------------ | ------------ | ----------------------------------------------------------------------------------------- |
| `rootPath`         | project root | Where to list from.                                                                       |
| `itemType`         | both         | `'file'` or `'directory'`.                                                                |
| `depthLimit`       | no limit     | How many folders deep to list.                                                            |
| `excludePath`      |              | `(info) => boolean`. `info` is `{ path, name, isDir }`. Excluded folders are not entered. |
| `allowManualInput` | `false`      | Add an option to type a path that is not in the list.                                     |

The answer is the path, with forward slashes, starting with `rootPath`.

### editor

Opens the user's editor (`$VISUAL` or `$EDITOR`) for longer text.

```ts
{ name: 'DESCRIPTION', type: 'editor', message: 'Description:', postfix: '.md' }
```

`postfix` is the temporary file's extension, so the editor highlights it correctly.

## Answers in other places

- **`--answer KEY=value`** and **`--answers file.json`** answer questions from the
  command line. Text is converted to the question's type. See
  [answering questions in advance](command-line.md#answering-questions-in-advance).
- **`--rerun`** replays the previous answers without asking. Questions added since are
  asked.
- **[Programmatic API](api.md)**: `scaffold({ answers: { STYLE: 'css' } })` answers
  questions from code. Questions that are not answered use their default.

## Typing answers

Give `defineConfig` an interface for your answers. Question names are then checked,
and `answers` is typed in `variables`, `macros` and `beforeRun`:

```ts
interface IAnswers {
  STYLE: 'css' | 'tailwind' | 'none';
  WITH_TESTS: boolean;
}

export default defineConfig<IAnswers>({
  prompts: [
    { name: 'STYLE', type: 'select', message: 'Styling:', choices: [...] },
    { name: 'WITH_TESTS', type: 'confirm', message: 'Add tests?' },
  ],
  variables: ({ name, answers }) => ({
    STYLE_IMPORT: answers.STYLE === 'css' ? `import './${name}.css';` : '',
  }),
});
```
