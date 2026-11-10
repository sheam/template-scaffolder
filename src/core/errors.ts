export type ErrorCode =
  | 'NO_SCAFFOLDING'
  | 'TEMPLATE_NOT_FOUND'
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_LOAD_FAILED'
  | 'CONFIG_INVALID'
  | 'CONFIG_FUNCTION_FAILED'
  | 'LAST_RUN_MISSING'
  | 'LAST_RUN_INVALID'
  | 'DESTINATION_INVALID'
  | 'MISSING_ANSWER'
  | 'INVALID_ANSWER'
  | 'HOOK_FAILED'
  | 'INVALID_ARGS'
  | 'SOURCE_READ_FAILED'
  | 'MIGRATE_REFUSED'
  | 'INIT_REFUSED'
  | 'CANCELLED';

/** Expected failures with a message meant for the user. Anything else is a bug. */
export class ScaffolderError extends Error {
  readonly code: ErrorCode;
  /** Extra lines (e.g. a list of validation problems). */
  readonly details: string[];

  constructor(
    code: ErrorCode,
    message: string,
    options?: { details?: string[]; cause?: unknown }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'ScaffolderError';
    this.code = code;
    this.details = options?.details ?? [];
  }
}

export class UserCancelledError extends ScaffolderError {
  constructor() {
    super('CANCELLED', 'Cancelled');
    this.name = 'UserCancelledError';
  }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
