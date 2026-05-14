// Returns true if `name` matches `query`. When `useRegex` is true and the query
// is an invalid regex, returns false (no match) — the toolbar surfaces the
// invalid state via its red border.
export function matchesQuery(name: string, query: string, useRegex: boolean): boolean {
  if (!query) return false;
  if (useRegex) {
    try {
      return new RegExp(query, "i").test(name);
    } catch {
      return false;
    }
  }
  return name.toLowerCase().includes(query.toLowerCase());
}
