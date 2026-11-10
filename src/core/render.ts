import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { render } from 'velocityjs';
import { errorMessage, ScaffolderError } from './errors.js';
import type { MacroObject, PatternList, TemplateVariables } from './types.js';

const INCLUDE_RX = /#include\(['"]?([^'")]+)['"]?\)/gi;

/** Render a Velocity string. Each call gets its own copy of the variables (#set cannot leak). */
export function renderString(
  text: string,
  variables: TemplateVariables,
  macros: MacroObject = {}
): string {
  return render(text, { ...variables }, macros);
}

export interface IRenderInput {
  sourcePath: string;
  includesDir: string;
  variables: TemplateVariables;
  macros: MacroObject;
  stripLines: PatternList;
}

/**
 * Read a template, expand #include lines, strip lines, then render with Velocity.
 * CRLF templates render like LF ones, and the output keeps the template's line endings.
 */
export async function renderTemplateFile(input: IRenderInput): Promise<string> {
  const chain: string[] = [];
  try {
    const text = await readFile(input.sourcePath, 'utf-8');
    const lines = await expandLines(
      { path: input.sourcePath, text },
      input,
      chain
    );
    const output = renderString(
      lines.join('\n'),
      input.variables,
      input.macros
    );
    return text.includes('\r\n') ? output.replace(/\r?\n/g, '\r\n') : output;
  } catch (e) {
    if (e instanceof ScaffolderError) throw e;
    const via =
      chain.length > 1
        ? ` (via ${chain.map(c => path.basename(c)).join(' -> ')})`
        : '';
    throw new Error(`${errorMessage(e)}${via}`, { cause: e });
  }
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
