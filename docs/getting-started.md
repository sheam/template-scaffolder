[Docs](README.md) › Getting started

# Getting started

This guide builds a template that generates a React component and its test, then
shows how to organise a `scaffolding` folder as you add more templates.

## Install

template-scaffolder needs Node.js 22.12 or later. Install it as a dev dependency so
everyone on the team gets the same version:

```sh
npm install --save-dev template-scaffolder
```

Add a script to `package.json` so it is easy to find:

```json
{
  "scripts": {
    "scaffold": "scaffolder"
  }
}
```

The scaffolder saves your last run's answers in `.template-scaffolder-last-run` in the
project root (see [re-running](command-line.md#re-running)). Each developer has their
own, so add it to `.gitignore`.

## Your first template

A template is a folder inside `scaffolding/` at the root of your project. It holds a
config file and the files to generate.

### 1. Create the folder and config

`scaffolding/component/scaffolding.config.ts`:

```ts
import { defineConfig } from 'template-scaffolder';

export default defineConfig({
  name: 'React component',
  description: 'A component with a test',
  destinations: ['src/components', 'src/pages'],
});
```

`name` and `description` are shown when choosing a template. `destinations` is the
list of folders offered for the output. The config can also be `.js`, `.mjs`, `.cjs`,
`.mts` or `.cts`. `defineConfig` only adds type checking and completion, so leave it
out in plain JavaScript if you prefer.

### 2. Add template files

Every other file in the folder is a template. `${NAME}` is replaced by the name you
enter, in file names as well as contents.

`scaffolding/component/${NAME}.tsx`:

```tsx
export interface I${NAME}Props {
  label: string;
}

export const ${NAME} = ({ label }: I${NAME}Props) => (
  <div data-testid="${NAME}">{label}</div>
);
```

`scaffolding/component/__tests__/${NAME}.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { ${NAME} } from '../${NAME}';

it('renders', () => {
  render(<${NAME} label="hello" />);
  expect(screen.getByTestId('${NAME}')).toHaveTextContent('hello');
});
```

### 3. Run it

```text
$ npm run scaffold
✔ Select the template: React component - A component with a test
✔ Enter the name: SaveButton
✔ Select a destination directory: src/components
  created  src/components/SaveButton/SaveButton.tsx
  created  src/components/SaveButton/__tests__/SaveButton.test.tsx
Created 2 of 2 files in 0.09s.
```

The files go into a folder named after the name you entered. Set
`createNameDir: false` in the config to put them straight into the destination.

To see the output without writing anything, add `--dryRun`. To run the same thing
again after changing the template, use `--rerun --overwrite`.

### 4. Ask questions

Templates often need more than a name. Add `prompts` to the config and use the
answers in templates by the question's `name`:

```ts
export default defineConfig({
  name: 'React component',
  destinations: ['src/components', 'src/pages'],
  prompts: [
    {
      name: 'WITH_TEST',
      type: 'confirm',
      message: 'Add a test?',
      default: true,
    },
    {
      name: 'STYLE',
      type: 'select',
      message: 'Styling:',
      choices: [{ value: 'css' }, { value: 'tailwind' }, { value: 'none' }],
    },
  ],
});
```

```tsx
#if($STYLE == 'css')
import './${NAME}.css';
#end

export const ${NAME} = () => <div data-testid="${NAME}" />;
```

[Questions](questions.md) lists every question type. [Template files](templates.md)
covers `#if`, `#foreach` and the rest of the template language.

### 5. Compute variables

Use `variables` for values derived from the name or the answers, so templates stay
simple:

```ts
variables: ({ name, answers }) => ({
  KEBAB_NAME: name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
  TEST_FILE: answers.WITH_TEST ? `${name}.test.tsx` : '',
}),
```

## Organising a scaffolding folder

As you add templates, share code between them with folders whose names start with
`_`. They are never offered as templates.

```text
scaffolding/
├── tsconfig.json              optional: editor support for TypeScript configs
├── _helpers/                  shared code for configs
│   ├── strings.ts
│   └── defaultConfig.ts
├── _includes/                 snippets pulled into templates with #include
│   └── fileHeader.ts
├── component/
│   ├── scaffolding.config.ts
│   ├── ${NAME}.tsx
│   └── __tests__/
│       └── ${NAME}.test.tsx
└── page/
    ├── scaffolding.config.ts
    └── ${NAME}Page.tsx
```

- **`_helpers`**: configs are ordinary TypeScript, so they can import from here. Put
  shared prompts, variables and macros in a function and spread it into each config.
  See [sharing config](configuration.md#sharing-config-between-templates).
- **`_includes`**: a line `#include(fileHeader.ts)` in any template is replaced by
  `_includes/fileHeader.ts`. See [includes](templates.md#includes).
- **`tsconfig.json`**: configs are run directly, without compiling, so this is only
  for your editor. Something like:

  ```json
  {
    "compilerOptions": {
      "module": "NodeNext",
      "target": "ES2022",
      "strict": true,
      "noEmit": true
    },
    "include": ["**/*.ts", "**/*.mts"]
  }
  ```

A file in a template folder that is not a template, such as a helper only that
template uses, must be listed in `ignore` or it will be generated too:

```ts
ignore: ['helpers.ts'],
```

## Next steps

- [Configuration](configuration.md) for every config field.
- [Hooks](hooks.md) to run Prettier or `git add` on the new files.
- [Reading source code](source-readers.md) to generate code from your existing code.
