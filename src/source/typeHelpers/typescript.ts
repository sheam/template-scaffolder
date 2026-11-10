/** Helpers for TypeScript type text as produced by the TypeScript reader. */

/** `Foo | undefined | null` -> `Foo`. Throws if nothing is left. */
export function primaryType(typeText: string): string {
  const parts = splitTopLevel(typeText, '|').filter(
    t => t !== 'undefined' && t !== 'null'
  );
  if (!parts.length)
    throw new Error(`could not get primary type for '${typeText}'`);
  return parts[0];
}

/** `Promise<Foo>` -> `Foo`; anything else unchanged. */
export function unwrapPromise(typeText: string): string {
  const m = /^Promise<(.*)>$/s.exec(typeText.trim());
  return m ? m[1].trim() : typeText.trim();
}

/** `Foo[]` or `Array<Foo>` -> `Foo`; anything else unchanged. */
export function unwrapArray(typeText: string): string {
  const t = typeText.trim();
  if (t.endsWith('[]')) return t.slice(0, -2).replace(/^\((.*)\)$/s, '$1');
  const m = /^(?:ReadonlyArray|Array)<(.*)>$/s.exec(t);
  return m ? m[1].trim() : t;
}

export function isArrayType(typeText: string): boolean {
  return unwrapArray(typeText) !== typeText.trim();
}

const PRIMITIVES = new Set([
  'string',
  'number',
  'boolean',
  'bigint',
  'symbol',
  'any',
  'unknown',
  'never',
  'void',
  'object',
  'null',
  'undefined',
  'Date',
]);

export function isPrimitive(typeText: string): boolean {
  return PRIMITIVES.has(typeText.trim());
}

/** Split on a separator that is not nested in <>, (), [] or {}. */
export function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if ('<([{'.includes(ch)) depth++;
    else if ('>)]}'.includes(ch)) depth--;
    if (ch === separator && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}
