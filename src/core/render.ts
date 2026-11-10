import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Compile, Helper, parse } from 'velocityjs';
import { errorMessage, ScaffolderError } from './errors.js';
import type { MacroObject, PatternList, TemplateVariables } from './types.js';

const INCLUDE_RX = /#include\(['"]?([^'")]+)['"]?\)/gi;

/** A `$reference` node of Velocity's syntax tree. */
type ReferenceAst = Parameters<typeof Helper.getRefText>[0] & {
  leader?: string;
};

/** Velocity's compiler, noting every `$reference` it outputs unresolved (as written). */
class TrackingCompile extends Compile {
  readonly unresolved = new Set<string>();

  constructor(private readonly lines: string[]) {
    super(parse(lines.join('\n')));
  }

  // The base class declares the parameter as any syntax node; it is only called with references.
  protected override getReferences(ast: never, isVal?: boolean): string {
    const value = super.getReferences(ast, isVal);
    const ref = ast as ReferenceAst;
    if (isVal && ref.leader !== '$!' && !this.silence) {
      const text = Helper.getRefText(ref);
      if (value === text && !this.inTemplateLiteral(ref)) {
        this.unresolved.add(text);
      }
    }
    return value;
  }

  /**
   * `${id}` inside backticks is almost always a JavaScript template literal that
   * belongs in the output, not a misspelled variable.
   */
  private inTemplateLiteral(ref: ReferenceAst): boolean {
    const pos = ref.pos as typeof ref.pos | undefined;
    if (!pos) return false;
    const line = this.lines[pos.first_line - 1] ?? '';
    const before = line.slice(0, pos.first_column);
    return (before.match(/`/g)?.length ?? 0) % 2 === 1;
  }
}

export interface IRendered {
  output: string;
  /** References left as written because they did not resolve, e.g. `$TYPO`, `$item.nmae`. */
  unresolved: string[];
}

/** Render a Velocity string. Each call gets its own copy of the variables (#set cannot leak). */
export function renderVelocity(
  text: string,
  variables: TemplateVariables,
  macros: MacroObject = {}
): IRendered {
  const compiler = new TrackingCompile(text.split('\n'));
  const output = compiler.render({ ...variables }, macros);
  return { output, unresolved: [...compiler.unresolved] };
}

/** Render a Velocity string, ignoring unresolved references. */
export function renderString(
  text: string,
  variables: TemplateVariables,
  macros: MacroObject = {}
): string {
  return renderVelocity(text, variables, macros).output;
}

export interface IRenderInput {
  sourcePath: string;
  includesDir: string;
  variables: TemplateVariables;
  macros: MacroObject;
  stripLines: PatternList;
  /** Keep the line break after a directive or macro call that ends a line of text. */
  keepLineBreaks?: boolean;
}

/**
 * Read a template, expand #include lines, strip lines, then render with Velocity.
 * CRLF templates render like LF ones, and the output keeps the template's line endings.
 */
export async function renderTemplateFile(
  input: IRenderInput
): Promise<IRendered> {
  const chain: string[] = [];
  try {
    const text = await readFile(input.sourcePath, 'utf-8');
    const lines = await expandLines(
      { path: input.sourcePath, text },
      input,
      chain
    );
    const source = input.keepLineBreaks ? lines.map(keepLineBreak) : lines;
    const { output, unresolved } = renderVelocity(
      source.join('\n'),
      input.variables,
      input.macros
    );
    return {
      output: text.includes('\r\n') ? output.replace(/\r?\n/g, '\r\n') : output,
      unresolved,
    };
  } catch (e) {
    if (e instanceof ScaffolderError) throw e;
    const via =
      chain.length > 1
        ? ` (via ${chain.map(c => path.basename(c)).join(' -> ')})`
        : '';
    throw new Error(`${errorMessage(e)}${via}`, { cause: e });
  }
}

/** A directive or macro call closing a line of text: `#end`, `#else`, `#upperFirst($NAME)`. */
const TRAILING_DIRECTIVE =
  /#\{?(?:end|else)\}?\s*$|#\{?[A-Za-z_][\w-]*\}?\s*\(.*\)\s*$/;
const KEEP_LINE_BREAK = '$!{__keepLineBreak}';

/**
 * Velocity removes the line break after a line's last directive. On lines of text
 * (not lines that are only a directive, like `#if(...)` or `#end`) that is rarely
 * wanted, so an empty silent reference is added after the directive to keep it. A
 * trailing `## comment` becomes a block comment for the same reason.
 */
export function keepLineBreak(line: string): string {
  if (line.trimStart().startsWith('#')) return line;
  const comment = line.indexOf('##');
  if (comment >= 0) {
    const text = line.slice(comment + 2).replaceAll('*#', '* #');
    return `${line.slice(0, comment)}#*${text}*#${KEEP_LINE_BREAK}`;
  }
  return TRAILING_DIRECTIVE.test(line) ? line + KEEP_LINE_BREAK : line;
}

function shouldStrip(line: string, patterns: PatternList): boolean {
  return patterns.some(p =>
    typeof p === 'string' ? line.trimStart().startsWith(p) : p.test(line)
  );
}

async function expandLines(
  file: { path: string; text: string },
  input: IRenderInput,
  chain: string[]
): Promise<string[]> {
  if (chain.includes(file.path)) {
    throw new Error(
      `#include cycle: ${[...chain, file.path].map(c => path.basename(c)).join(' -> ')}`
    );
  }
  chain.push(file.path);
  const result: string[] = [];
  for (const line of file.text.split(/\r?\n/)) {
    if (shouldStrip(line, input.stripLines)) continue;
    const includes = Array.from(line.matchAll(INCLUDE_RX));
    if (includes.length === 0) {
      result.push(line);
      continue;
    }
    // The whole line is replaced by the included file(s), as in 2.x.
    for (const match of includes) {
      const includePath = path.join(input.includesDir, match[1]);
      result.push(
        ...(await expandLines(
          { path: includePath, text: await readFile(includePath, 'utf-8') },
          input,
          chain
        ))
      );
    }
  }
  chain.pop();
  return result;
}
