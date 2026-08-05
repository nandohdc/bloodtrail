// Explicit code-unit ordering, identical to the default sort for strings.
// Deliberately not localeCompare: these orderings are written into evidence
// JSON that is committed and validated, so they must be byte-stable across
// machines rather than depending on the runner's LANG/ICU collation data.
export const byCodePoint = (a, b) => {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}
