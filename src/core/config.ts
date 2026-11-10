import { errorMessage, ScaffolderError } from './errors.js';
import type { ISourceReader } from '../source/types.js';
import type {
  Answers,
  IConfigFile,
  IHooks,
  IMacrosContext,
  IPromptsContext,
  IVariablesContext,
  MacroObject,
  PatternList,
  TemplateVariables,
} from './types.js';

/**
 * Identity function that gives config files type checking and inference.
 *
 * ```ts
 * export default defineConfig<{ COLOUR: string }>({ ... });
 * ```
 */
export function defineConfig<TAnswers extends object = Answers>(
  config: IConfigFile<TAnswers>
): IConfigFile<TAnswers> {
  return config;
}

/** The single shape the core works with, whatever the user wrote. */
export interface INormalizedConfig {
  name: string;
  description?: string;
  version: string;
  prompts: (ctx: IPromptsContext) => Promise<unknown>;
  variables: (ctx: IVariablesContext) => Promise<TemplateVariables>;
  macros: (ctx: IMacrosContext) => Promise<MacroObject>;
  destination?: string;
  destinations?: string[];
  createNameDir: boolean;
  srcRoot?: string;
  stripLines: PatternList;
  ignore: string[];
  hooks: IHooks;
  readers: ISourceReader[];
  strictVariables: boolean;
  keepLineBreaks: boolean;
}

export interface INormalizeResult {
  config: INormalizedConfig;
  warnings: string[];
}

const KNOWN_KEYS = new Set([
  'name',
  'description',
  'version',
  'prompts',
  'variables',
  'macros',
  'destination',
  'destinations',
  'createNameDir',
  'srcRoot',
  'stripLines',
  'ignore',
  'hooks',
  'readers',
  'strictVariables',
  'keepLineBreaks',
  // 2.x, accepted with a warning:
  'afterFileCreated',
]);

const MIGRATE_HINT =
  'If this template was written for template-scaffolder 2.x, run `npx scaffolder migrate`.';

/**
 * Validate a loaded config and convert it to the normalized shape.
 * Throws CONFIG_INVALID listing every problem found.
 */
export function normalizeConfig(
  raw: unknown,
  templateDir: string
): INormalizeResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ScaffolderError(
      'CONFIG_INVALID',
      `The config for template '${templateDir}' must default-export an object (got ${describe(raw)}).`
    );
  }
  const c = raw as Record<string, unknown>;
  const errors: string[] = [];
  const warnings: string[] = [];
  const name = typeof c.name === 'string' && c.name ? c.name : templateDir;

  for (const key of Object.keys(c)) {
    if (!KNOWN_KEYS.has(key))
      warnings.push(`unknown config key '${key}' (ignored).`);
  }

  const optionalString = (key: string): string | undefined => {
    if (c[key] === undefined) return undefined;
    if (typeof c[key] !== 'string') errors.push(`'${key}' must be a string.`);
    return c[key] as string;
  };
  const description = optionalString('description');
  const version = optionalString('version') ?? '1.0';
  let destination = optionalString('destination');
  const srcRoot = optionalString('srcRoot');

  let destinations: string[] | undefined;
  if (typeof c.destinations === 'string') {
    warnings.push(
      `'destinations' as a single string is deprecated, use 'destination: "${c.destinations}"'.`
    );
    destination ??= c.destinations;
  } else if (c.destinations !== undefined) {
    if (!isStringArray(c.destinations)) {
      errors.push(`'destinations' must be an array of strings.`);
    } else {
      destinations = c.destinations;
    }
  }

  for (const key of ['createNameDir', 'strictVariables', 'keepLineBreaks']) {
    if (c[key] !== undefined && typeof c[key] !== 'boolean') {
      errors.push(`'${key}' must be true or false.`);
    }
  }
  if (
    c.stripLines !== undefined &&
    !(
      Array.isArray(c.stripLines) &&
      c.stripLines.every(x => typeof x === 'string' || x instanceof RegExp)
    )
  ) {
    errors.push(
      `'stripLines' must be an array of strings and regular expressions.`
    );
  }
  if (c.ignore !== undefined && !isStringArray(c.ignore)) {
    errors.push(`'ignore' must be an array of glob strings.`);
  }

  const hooks = normalizeHooks(c, errors, warnings);
  const readers = normalizeReaders(c.readers, errors);

  const common = { config: c, templateName: name, errors };
  const prompts = factory({
    ...common,
    key: 'prompts',
    allowed: ['array', 'function'],
    fallback: [],
  });
  const variables = factory<TemplateVariables>({
    ...common,
    key: 'variables',
    allowed: ['object', 'function'],
    fallback: {},
  });
  const macros = factory<MacroObject>({
    ...common,
    key: 'macros',
    allowed: ['object', 'function'],
    fallback: {},
  });

  if (errors.length) {
    throw new ScaffolderError(
      'CONFIG_INVALID',
      `Invalid config for template '${templateDir}':`,
      { details: errors }
    );
  }

  return {
    config: {
      name,
      description,
      version,
      prompts: prompts as INormalizedConfig['prompts'],
      variables: variables as INormalizedConfig['variables'],
      macros: macros as INormalizedConfig['macros'],
      destination,
      destinations,
      createNameDir: c.createNameDir !== false,
      srcRoot,
      stripLines: (c.stripLines as PatternList | undefined) ?? [],
      ignore: (c.ignore as string[] | undefined) ?? [],
      hooks,
      readers,
      strictVariables: c.strictVariables === true,
      keepLineBreaks: c.keepLineBreaks === true,
    },
    warnings,
  };
}

function normalizeHooks(
  c: Record<string, unknown>,
  errors: string[],
  warnings: string[]
): IHooks {
  const hooks: Record<string, unknown> = {};
  if (c.hooks !== undefined) {
    if (!c.hooks || typeof c.hooks !== 'object') {
      errors.push(`'hooks' must be an object.`);
    } else {
      Object.assign(hooks, c.hooks);
    }
  }
  if (c.afterFileCreated !== undefined) {
    warnings.push(
      `top-level 'afterFileCreated' is deprecated, use 'hooks.afterFileCreated'. ${MIGRATE_HINT}`
    );
    if (typeof c.afterFileCreated === 'function') {
      const legacy = c.afterFileCreated as (...a: unknown[]) => unknown;
      // 2.x signature: (path, dryRun, variables)
      hooks.afterFileCreated ??= (ctx: {
        path: string;
        dryRun: boolean;
        variables: TemplateVariables;
      }) => legacy(ctx.path, ctx.dryRun, ctx.variables);
    }
  }
  for (const [key, value] of Object.entries(hooks)) {
    if (!['beforeRun', 'afterFileCreated', 'afterRun'].includes(key)) {
      errors.push(
        `unknown hook 'hooks.${key}'. Expected beforeRun, afterFileCreated or afterRun.`
      );
    } else if (typeof value !== 'function') {
      errors.push(`'hooks.${key}' must be a function.`);
    }
  }
  return hooks as IHooks;
}

function normalizeReaders(value: unknown, errors: string[]): ISourceReader[] {
  if (value === undefined) return [];
  const ok =
    Array.isArray(value) &&
    value.every(
      r =>
        r &&
        typeof r === 'object' &&
        typeof r.id === 'string' &&
        isStringArray(r.extensions) &&
        typeof r.read === 'function'
    );
  if (!ok) {
    errors.push(
      `'readers' must be an array of source readers (see defineSourceReader).`
    );
    return [];
  }
  return value as ISourceReader[];
}

/** Turn a value-or-function field into an async function, wrapping errors with context. */
function factory<T>(f: {
  config: Record<string, unknown>;
  templateName: string;
  key: string;
  allowed: Array<'array' | 'object' | 'function'>;
  errors: string[];
  fallback: T;
}): (ctx: unknown) => Promise<T> {
  const { key, allowed, errors, fallback } = f;
  const value = f.config[key];
  if (value === undefined) return async () => fallback;
  if (typeof value === 'function') {
    if (value.length > 1) {
      errors.push(
        `'${key}' takes ${value.length} parameters; in v3 it receives a single context object. ${MIGRATE_HINT}`
      );
    }
    return async ctx => {
      try {
        return (await value(ctx)) as T;
      } catch (e) {
        const hint = e instanceof TypeError ? ` ${MIGRATE_HINT}` : '';
        throw new ScaffolderError(
          'CONFIG_FUNCTION_FAILED',
          `'${key}' in template '${f.templateName}' threw: ${errorMessage(e)}${hint}`,
          { cause: e }
        );
      }
    };
  }
  const kind = Array.isArray(value) ? 'array' : typeof value;
  if (!allowed.includes(kind as 'array' | 'object')) {
    errors.push(
      `'${key}' must be ${allowed.map(a => `an ${a}`).join(' or ')}.`
    );
  }
  return async () => value as T;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(x => typeof x === 'string');
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'an array';
  return typeof v;
}
