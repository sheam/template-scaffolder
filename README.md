# template-scaffolder

Templates for the files your team creates over and over, so every new component,
page or service starts out the same way.

You keep templates in a `scaffolding` folder in your project. Running `scaffolder`
asks which template to use, a name and any questions the template defines, then
generates all of its files at once.

- Templates are ordinary files, written in [Velocity](https://velocity.apache.org/engine/1.7/user-guide.html),
  with variables in file names and contents.
- Each template has a TypeScript or JavaScript config that asks questions, computes
  variables and defines macros.
- Configs can read your existing TypeScript, C# or C++ code (or other languages, with
  a reader you add), for example to list an API client's endpoints or an enum's
  members.
- Hooks run formatters or `git add` on the files that were created.
- Use it from the command line or from code.

> **Upgrading from 2.x?** Read [Migrating to v3](docs/migrating-to-v3.md).
> `scaffolder migrate` converts your configs.

If you feel like it...

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/sheamus)

## Quick start

Requires Node.js 22.12 or later.

```sh
npm install --save-dev template-scaffolder
```

Create a template folder with a config and the files to generate:

```text
scaffolding/
└── component/
    ├── scaffolding.config.ts
    └── ${NAME}.tsx
```

`scaffolding/component/scaffolding.config.ts`:

```ts
import { defineConfig } from 'template-scaffolder';

export default defineConfig({
  name: 'React component',
  destinations: ['src/components'],
  prompts: [
    {
      name: 'WITH_PROPS',
      type: 'confirm',
      message: 'Add props?',
      default: true,
    },
  ],
});
```

`scaffolding/component/${NAME}.tsx`:

```tsx
#if($WITH_PROPS)
export interface I${NAME}Props {}

export const ${NAME} = (props: I${NAME}Props) => <div data-testid="${NAME}" />;
#else
export const ${NAME} = () => <div data-testid="${NAME}" />;
#end
```

Run it:

```text
$ npx scaffolder
✔ Select the template: React component
✔ Enter the name: SaveButton
✔ Add props? Yes
✔ Select a destination directory: src/components
  created  src/components/SaveButton/SaveButton.tsx
Created 1 of 1 files in 0.09s.
```

[Getting started](docs/getting-started.md) goes through this step by step.

## Documentation

| Guide                                                      | Covers                                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Getting started](docs/getting-started.md)                 | Installing, your first template, and how to lay out a `scaffolding` folder. |
| [Command line](docs/command-line.md)                       | Options, re-running, dry runs and exit codes.                               |
| [Configuration](docs/configuration.md)                     | Every config field, the variables templates see, and sharing config.        |
| [Questions](docs/questions.md)                             | Every question type, with examples.                                         |
| [Template files](docs/templates.md)                        | Velocity syntax, file names, includes, macros and stripping lines.          |
| [Hooks](docs/hooks.md)                                     | Running formatters, `git add` and other commands after generating.          |
| [Reading source code](docs/source-readers.md)              | Using your existing TypeScript, C# and C++ code in templates.               |
| [Writing a source reader](docs/writing-a-source-reader.md) | Adding a reader for another language.                                       |
| [Programmatic API](docs/api.md)                            | Running templates from your own code and tests.                             |
| [Migrating to v3](docs/migrating-to-v3.md)                 | Upgrading from 2.x.                                                         |

The repository's [`scaffolding`](scaffolding) folder and [`docs/examples`](docs/examples)
have working examples.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how the code is organised, how to run the
tests, and where to add a question type, a hook or a source reader. Changes are listed
in the [CHANGELOG](CHANGELOG.md).

## License

[MIT](LICENSE)
