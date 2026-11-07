import { ScaffolderError } from '../core/errors.js';
import type { IReporter } from '../core/ports.js';

export interface IMigrateOptions {
  projectRoot: string;
  dir: string;
  dryRun: boolean;
  force: boolean;
  reporter: IReporter;
}

export async function runMigrate(
  _options: IMigrateOptions
): Promise<{ ok: boolean }> {
  throw new ScaffolderError('INVALID_ARGS', 'migrate is not implemented yet');
}
