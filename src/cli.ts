import { IArgsConfig, processArgs } from 'node-cli-arg-by-config';
import { ICliArgs } from './types/index.js';

const cliConfig: IArgsConfig = {
  helpHeader: 'scaffolder <args>',
  definitions: [
    {
      name: 'dryRun',
      type: 'boolean',
      description:
        'If set then resulting files will just be written to STDOUT.',
    },
    {
      name: 'overwrite',
      type: 'boolean',
      required: false,
      description: 'Overwrite output files.',
    },
    { name: 'name', description: 'Name of the output.' },
    {
      name: 'template',
      description: 'Name of the template. This folder in scaffolding directory',
    },
    {
      name: 'destination',
      index: 0,
      required: false,
      description: 'Root folder where generated files are to be deployed.',
    },
    {
      name: 'parallel',
      type: 'boolean',
      description:
        'Process all files at the same time. The default is process one file at a time.',
    },
    {
      name: 'workDir',
      type: 'string',
      description:
        'Use the directory as the working directory. Useful for debugging..',
    },
  ],
};

export function getArgs(): ICliArgs {
  const args = processArgs<ICliArgs>(cliConfig);
  if (!args) {
    process.exit(-1);
  }
  return args;
}
