#!/usr/bin/env node
/* eslint-disable no-console -- CLI entry point */
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorMessage, ScaffolderError } from '../core/errors.js';
import { initScaffolding } from '../core/init.js';
import { run } from '../core/run.js';
import { listTemplates } from '../index.js';
import { HELP, type IScaffoldCommand, parseCli } from './args.js';
import { createConsolePrompter } from './prompter.js';
import { createConsoleReporter, printCommands } from './reporter.js';
import type { IReporter } from '../core/ports.js';
import type { Answers } from '../core/types.js';

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;
const EXIT_CANCELLED = 130;

/** Set from --debug once arguments are parsed; DEBUG=true works even if parsing fails. */
let debug = process.env.DEBUG === 'true';

function version(): string {
  const pkgPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../package.json'
  );
  return (JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string })
    .version;
}

async function main(argv: string[]): Promise<number> {
  const cmd = parseCli(argv);
  if (cmd.command === 'help') {
    console.log(HELP);
    return EXIT_OK;
  }
  if (cmd.command === 'version') {
    console.log(version());
    return EXIT_OK;
  }

  debug = cmd.debug;
  // Everything (configs, relative paths in templates, hook commands) runs relative to the working directory.
  if (cmd.workDir) process.chdir(cmd.workDir);
  const reporter = createConsoleReporter({ debug: cmd.debug });
  reporter.debug(`working directory: ${process.cwd()}`);

  switch (cmd.command) {
    case 'migrate': {
      const { runMigrate } = await import('../migrate/index.js');
      const result = await runMigrate({
        projectRoot: process.cwd(),
        dir: cmd.dir,
        dryRun: cmd.dryRun,
        force: cmd.force,
        reporter,
      });
      return result.ok ? EXIT_OK : EXIT_FAILED;
    }
    case 'init': {
      await initScaffolding({
        projectRoot: process.cwd(),
        dryRun: cmd.dryRun,
        reporter,
      });
      if (!cmd.dryRun) {
        reporter.info(
          '\nTry it with `npx scaffolder --dryRun`, then copy scaffolding/example to make your own template.'
        );
      }
      return EXIT_OK;
    }
    case 'list': {
      const templates = await listTemplates({
        projectRoot: process.cwd(),
        reporter,
      });
      if (cmd.json) {
        console.log(JSON.stringify(templates, null, 2));
      } else {
        const width = Math.max(...templates.map(t => t.dir.length), 8);
        for (const t of templates) {
          const about = [t.name === t.dir ? '' : t.name, t.description]
            .filter(Boolean)
            .join(' - ');
          console.log(`${t.dir.padEnd(width)}  ${about}`.trimEnd());
        }
      }
      return EXIT_OK;
    }
    default:
      return scaffoldCommand(cmd, reporter);
  }
}

async function scaffoldCommand(
  cmd: IScaffoldCommand,
  reporter: IReporter
): Promise<number> {
  const answers: Answers = {
    ...(cmd.answersFile ? await readAnswersFile(cmd.answersFile) : {}),
    ...cmd.answers,
  };
  const start = performance.now();
  const result = await run(
    {
      template: cmd.template,
      name: cmd.name,
      destination: cmd.destination,
      dryRun: cmd.dryRun,
      overwrite: cmd.overwrite,
      parallel: cmd.parallel,
      rerun: cmd.rerun,
      answers,
    },
    { projectRoot: process.cwd(), prompter: createConsolePrompter(), reporter }
  );
  printCommands(result.afterRunCommands, cmd.debug);
  const written = result.files.filter(
    f => f.status === 'created' || f.status === 'overwritten'
  );
  const seconds = ((performance.now() - start) / 1000).toFixed(2);
  reporter.info(
    `${result.dryRun ? 'Dry run: would create' : 'Created'} ${written.length} of ${result.files.length} files in ${seconds}s.`
  );
  return result.hasErrors ? EXIT_FAILED : EXIT_OK;
}

async function readAnswersFile(file: string): Promise<Answers> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, 'utf-8'));
  } catch (e) {
    throw new ScaffolderError(
      'INVALID_ARGS',
      `Could not read answers from ${file}: ${errorMessage(e)}`
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ScaffolderError(
      'INVALID_ARGS',
      `${file} must contain a JSON object of answers, like { "STYLE": "css" }.`
    );
  }
  return parsed as Answers;
}

function printStack(e: unknown): void {
  for (let cause = e; cause instanceof Error; cause = cause.cause) {
    console.error(cause === e ? cause.stack : `Caused by: ${cause.stack}`);
  }
}

main(process.argv.slice(2)).then(
  code => process.exit(code),
  (e: unknown) => {
    if (e instanceof ScaffolderError) {
      if (e.code !== 'CANCELLED') {
        console.error(e.message);
        e.details.forEach(d => console.error(`  - ${d}`));
        if (debug) printStack(e);
      }
      if (e.code === 'INVALID_ARGS')
        console.error('\nRun `scaffolder --help` for usage.');
      process.exit(
        e.code === 'CANCELLED'
          ? EXIT_CANCELLED
          : e.code === 'INVALID_ARGS'
            ? EXIT_USAGE
            : EXIT_FAILED
      );
    }
    console.error(`Unexpected error: ${errorMessage(e)}`);
    if (debug) printStack(e);
    else console.error('Run with --debug for details.');
    process.exit(EXIT_FAILED);
  }
);
