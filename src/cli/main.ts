#!/usr/bin/env node
/* eslint-disable no-console -- CLI entry point */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorMessage, ScaffolderError } from '../core/errors.js';
import { run } from '../core/run.js';
import { HELP, parseCli } from './args.js';
import { createConsolePrompter } from './prompter.js';
import { createConsoleReporter, printCommands } from './reporter.js';

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;
const EXIT_CANCELLED = 130;

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

  // Everything (configs, relative paths in templates, hook commands) runs relative to the working directory.
  if (cmd.workDir) process.chdir(cmd.workDir);
  const reporter = createConsoleReporter({ debug: cmd.debug });
  reporter.debug(`working directory: ${process.cwd()}`);

  if (cmd.command === 'migrate') {
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

main(process.argv.slice(2)).then(
  code => process.exit(code),
  (e: unknown) => {
    if (e instanceof ScaffolderError) {
      if (e.code !== 'CANCELLED') {
        console.error(e.message);
        e.details.forEach(d => console.error(`  - ${d}`));
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
    if (process.env.DEBUG === 'true' && e instanceof Error)
      console.error(e.stack);
    process.exit(EXIT_FAILED);
  }
);
