import { parseArgs } from 'node:util';
import { ScaffolderError } from '../core/errors.js';

interface ICommonOptions {
  workDir?: string;
  debug: boolean;
}

export interface IScaffoldCommand extends ICommonOptions {
  command: 'scaffold';
  template?: string;
  name?: string;
  destination?: string;
  dryRun?: boolean;
  overwrite?: boolean;
  parallel?: boolean;
  rerun?: boolean;
  /** From `--answer KEY=value`, as text; converted to each question's type later. */
  answers: Record<string, string>;
  /** From `--answers <file.json>`. */
  answersFile?: string;
}

export interface IMigrateCommand extends ICommonOptions {
  command: 'migrate';
  /** Folder to migrate, default 'scaffolding'. */
  dir: string;
  dryRun: boolean;
  force: boolean;
}

export interface IInitCommand extends ICommonOptions {
  command: 'init';
  dryRun: boolean;
}

export interface IListCommand extends ICommonOptions {
  command: 'list';
  json: boolean;
}

export type CliCommand =
  | IScaffoldCommand
  | IMigrateCommand
  | IInitCommand
  | IListCommand
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
  'json',
  'help',
  'version',
];

export const HELP = `Usage:
  scaffolder [destination] [options]     generate files from a template
  scaffolder init [options]              create a scaffolding folder with an example template
  scaffolder list [options]              list the templates
  scaffolder migrate [folder] [options]  convert 2.x template configs to 3.x

Scaffold options (anything not given is asked for):
  --template <name>     template folder (or the 'name' in its config)
  --name <name>         instance name, available to templates as NAME
  --destination <dir>   output directory (or pass it as the first argument)
  --answer <KEY=value>  answer a question; repeat for more answers
  --answers <file>      answer questions from a JSON file of { "KEY": value }
  --dryRun              print what would be generated; write nothing, run no commands
  --overwrite           replace existing files (default: skip them)
  --parallel            run afterFileCreated hook commands for different files concurrently
  --rerun               replay the previous run's template, name, destination and answers;
                        options given alongside it override the replayed ones

Init options:
  --dryRun              list the files that would be created

List options:
  --json                print the templates as JSON

Migrate options:
  --dryRun              show the changes as a diff, do not write
  --force               run even if the git working tree has uncommitted changes

Options for every command:
  --workDir <dir>       run as if started in <dir>
  --debug               verbose output, and stack traces for errors (also DEBUG=true)
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

/** Options each command accepts, besides --workDir and --debug. */
const COMMAND_OPTIONS: Record<string, string[]> = {
  scaffold: [
    'template',
    'name',
    'destination',
    'answer',
    'answers',
    'dryRun',
    'overwrite',
    'parallel',
    'rerun',
  ],
  init: ['dryRun'],
  list: ['json'],
  migrate: ['dryRun', 'force'],
};

const SUBCOMMANDS = ['init', 'list', 'migrate'];

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
        answer: { type: 'string', multiple: true },
        answers: { type: 'string' },
        dryRun: { type: 'boolean' },
        'dry-run': { type: 'boolean' },
        overwrite: { type: 'boolean' },
        parallel: { type: 'boolean' },
        rerun: { type: 'boolean' },
        workDir: { type: 'string' },
        'work-dir': { type: 'string' },
        debug: { type: 'boolean' },
        force: { type: 'boolean' },
        json: { type: 'boolean' },
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
  const common: ICommonOptions = {
    workDir: v.workDir ?? v['work-dir'],
    debug: v.debug === true || process.env.DEBUG === 'true',
  };

  const command = SUBCOMMANDS.includes(positionals[0])
    ? positionals[0]
    : 'scaffold';
  const args = command === 'scaffold' ? positionals : positionals.slice(1);
  checkOptions(command, v);
  const maxArgs = command === 'init' || command === 'list' ? 0 : 1;
  if (args.length > maxArgs) {
    throw new ScaffolderError(
      'INVALID_ARGS',
      command === 'scaffold'
        ? `Expected at most one positional argument (the destination), got: ${args.join(' ')}`
        : `Unexpected arguments: ${args.join(' ')}`
    );
  }

  switch (command) {
    case 'init':
      return { command, dryRun: dryRun === true, ...common };
    case 'list':
      return { command, json: v.json === true, ...common };
    case 'migrate':
      return {
        command,
        dir: args[0] ?? 'scaffolding',
        dryRun: dryRun === true,
        force: v.force === true,
        ...common,
      };
    default:
      return {
        command: 'scaffold',
        template: v.template,
        name: v.name,
        destination: v.destination ?? args[0],
        dryRun,
        overwrite: v.overwrite,
        parallel: v.parallel,
        rerun: v.rerun,
        answers: parseAnswers(v.answer ?? []),
        answersFile: v.answers,
        ...common,
      };
  }
}

/** Reject options that do not apply to the command, e.g. `scaffolder list --overwrite`. */
function checkOptions(command: string, values: Record<string, unknown>): void {
  const allowed = new Set([
    ...COMMAND_OPTIONS[command],
    'workDir',
    'work-dir',
    'debug',
  ]);
  if (allowed.has('dryRun')) allowed.add('dry-run');
  const label =
    command === 'scaffold' ? 'generating files' : `\`scaffolder ${command}\``;
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && !allowed.has(key)) {
      throw new ScaffolderError(
        'INVALID_ARGS',
        `--${key} does not apply to ${label}.`
      );
    }
  }
}

function parseAnswers(entries: string[]): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const entry of entries) {
    const eq = entry.indexOf('=');
    if (eq <= 0) {
      throw new ScaffolderError(
        'INVALID_ARGS',
        `--answer expects KEY=value, got '${entry}'.`
      );
    }
    answers[entry.slice(0, eq)] = entry.slice(eq + 1);
  }
  return answers;
}
