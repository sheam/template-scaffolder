import { parseArgs } from 'node:util';
import { ScaffolderError } from '../core/errors.js';

export interface IScaffoldCommand {
  command: 'scaffold';
  template?: string;
  name?: string;
  destination?: string;
  dryRun?: boolean;
  overwrite?: boolean;
  parallel?: boolean;
  rerun?: boolean;
  workDir?: string;
  debug: boolean;
}

export interface IMigrateCommand {
  command: 'migrate';
  /** Folder to migrate, default 'scaffolding'. */
  dir: string;
  dryRun: boolean;
  force: boolean;
  workDir?: string;
  debug: boolean;
}

export type CliCommand =
  | IScaffoldCommand
  | IMigrateCommand
  | { command: 'help' }
  | { command: 'version' };

const BOOLEAN_FLAGS = [
  'dryRun',
  'dry-run',
  'overwrite',
  'parallel',
  'rerun',
  'debug',
  'force',
  'help',
  'version',
];

export const HELP = `Usage:
  scaffolder [destination] [options]     generate files from a template
  scaffolder migrate [folder] [options]  convert 2.x template configs to 3.x

Scaffold options (anything not given is asked for):
  --template <name>     template folder (or the 'name' in its config)
  --name <name>         instance name, available to templates as NAME
  --destination <dir>   output directory (or pass it as the first argument)
  --dryRun              print what would be generated; write nothing, run no commands
  --overwrite           replace existing files (default: skip them)
  --parallel            load configs, render files and run hook commands concurrently
  --rerun               replay the previous run's template, name, destination and answers;
                        options given alongside it override the replayed ones
  --workDir <dir>       run as if started in <dir>
  --debug               verbose output (also DEBUG=true)

Migrate options:
  --dryRun              show the changes as a diff, do not write
  --force               run even if the git working tree has uncommitted changes

  -h, --help            show this help
  -v, --version         show the version
`;

/** 2.x accepted --flag=true / --flag=false for booleans; keep those scripts working. */
function normalizeBooleanFlags(argv: string[]): string[] {
  return argv.flatMap(arg => {
    const m = /^--([\w-]+)=(true|false)$/i.exec(arg);
    if (!m || !BOOLEAN_FLAGS.includes(m[1])) return [arg];
    return m[2].toLowerCase() === 'true' ? [`--${m[1]}`] : [];
  });
}

export function parseCli(argv: string[]): CliCommand {
  let parsed;
  try {
    parsed = parseArgs({
      args: normalizeBooleanFlags(argv),
      allowPositionals: true,
      strict: true,
      options: {
        template: { type: 'string' },
        name: { type: 'string' },
        destination: { type: 'string' },
        dryRun: { type: 'boolean' },
        'dry-run': { type: 'boolean' },
        overwrite: { type: 'boolean' },
        parallel: { type: 'boolean' },
        rerun: { type: 'boolean' },
        workDir: { type: 'string' },
        'work-dir': { type: 'string' },
        debug: { type: 'boolean' },
        force: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (e) {
    throw new ScaffolderError('INVALID_ARGS', (e as Error).message);
  }
  const { values: v, positionals } = parsed;
  if (v.help) return { command: 'help' };
  if (v.version) return { command: 'version' };

  const dryRun = v.dryRun ?? v['dry-run'];
  const workDir = v.workDir ?? v['work-dir'];
  const debug = v.debug === true || process.env.DEBUG === 'true';

  if (positionals[0] === 'migrate') {
    if (positionals.length > 2) {
      throw new ScaffolderError(
        'INVALID_ARGS',
        `Unexpected arguments: ${positionals.slice(2).join(' ')}`
      );
    }
    return {
      command: 'migrate',
      dir: positionals[1] ?? 'scaffolding',
      dryRun: dryRun === true,
      force: v.force === true,
      workDir,
      debug,
    };
  }

  if (positionals.length > 1) {
    throw new ScaffolderError(
      'INVALID_ARGS',
      `Expected at most one positional argument (the destination), got: ${positionals.join(' ')}`
    );
  }
  if (v.force)
    throw new ScaffolderError(
      'INVALID_ARGS',
      '--force only applies to `scaffolder migrate`.'
    );
  return {
    command: 'scaffold',
    template: v.template,
    name: v.name,
    destination: v.destination ?? positionals[0],
    dryRun,
    overwrite: v.overwrite,
    parallel: v.parallel,
    rerun: v.rerun,
    workDir,
    debug,
  };
}
