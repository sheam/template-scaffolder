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

/** Read a template, expand #include lines, strip lines, then render with Velocity. */
export async function renderTemplateFile(input: IRenderInput): Promise<string> {
  const chain: string[] = [];
  let text: string;
  try {
    const lines = await readLines(input.sourcePath, input, chain);
    text = lines.join('\n');
    return renderString(text, input.variables, input.macros);
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

async function readLines(
  filePath: string,
  input: IRenderInput,
  chain: string[]
): Promise<string[]> {
  if (chain.includes(filePath)) {
    throw new Error(
      `#include cycle: ${[...chain, filePath].map(c => path.basename(c)).join(' -> ')}`
    );
  }
  chain.push(filePath);
  const text = await readFile(filePath, 'utf-8');
  const result: string[] = [];
  for (const line of text.split('\n')) {
    if (shouldStrip(line, input.stripLines)) continue;
    const includes = Array.from(line.matchAll(INCLUDE_RX));
    if (includes.length === 0) {
      result.push(line);
      continue;
    }
    // The whole line is replaced by the included file(s), as in 2.x.
    for (const match of includes) {
      result.push(
        ...(await readLines(
          path.join(input.includesDir, match[1]),
          input,
          chain
        ))
      );
    }
  }
  chain.pop();
  return result;
}
