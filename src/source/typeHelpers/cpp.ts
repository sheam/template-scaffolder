/** Helpers for C++ type text as produced by the C++ reader. */

/** `const std::string&` -> `std::string`. */
export function stripQualifiers(typeText: string): string {
  return typeText
    .replace(/\b(const|volatile|mutable|constexpr|static|inline)\b/g, '')
    .replace(/[&*]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Element type of `std::vector<T>`, `std::array<T, N>`, `std::list<T>`, `T[]`, ... */
export function elementType(typeText: string): string | null {
  const t = stripQualifiers(typeText);
  if (t.endsWith('[]')) return t.slice(0, -2).trim();
  const m =
    /^(?:std::)?(?:vector|list|deque|set|unordered_set|array|span)<\s*([^,>]+(?:<[^>]*>)?)/.exec(
      t
    );
  return m ? m[1].trim() : null;
}

/** `std::optional<T>` / `std::unique_ptr<T>` / `std::shared_ptr<T>` -> `T`. */
export function unwrapWrapper(typeText: string): string {
  const t = stripQualifiers(typeText);
  const m =
    /^(?:std::)?(?:optional|unique_ptr|shared_ptr|weak_ptr)<(.*)>$/s.exec(t);
  return m ? m[1].trim() : t;
}
