/** Helpers for C# type text as produced by the C# reader. */

/** `int?` / `Nullable<int>` -> `int`. */
export function unwrapNullable(typeText: string): string {
  const t = typeText.trim();
  const m = /^(?:System\.)?Nullable<(.*)>$/s.exec(t);
  if (m) return m[1].trim();
  return t.endsWith('?') ? t.slice(0, -1) : t;
}

/** `Task<T>` / `ValueTask<T>` -> `T`; `Task` -> `void`. */
export function unwrapTask(typeText: string): string {
  const t = typeText.trim();
  if (/^(?:System\.Threading\.Tasks\.)?(?:Value)?Task$/.test(t)) return 'void';
  const m = /^(?:System\.Threading\.Tasks\.)?(?:Value)?Task<(.*)>$/s.exec(t);
  return m ? m[1].trim() : t;
}

/** `ActionResult<T>` -> `T`. */
export function unwrapActionResult(typeText: string): string {
  const m = /^ActionResult<(.*)>$/s.exec(typeText.trim());
  return m ? m[1].trim() : typeText.trim();
}

/** Element type of arrays and common collections: `T[]`, `List<T>`, `IEnumerable<T>`, ... */
export function elementType(typeText: string): string | null {
  const t = unwrapNullable(typeText);
  if (t.endsWith('[]')) return t.slice(0, -2);
  const m =
    /^(?:[\w.]+\.)?(?:List|IList|IReadOnlyList|ICollection|IReadOnlyCollection|IEnumerable|HashSet|ISet|IQueryable|ImmutableArray|ImmutableList)<(.*)>$/s.exec(
      t
    );
  return m ? m[1].trim() : null;
}
