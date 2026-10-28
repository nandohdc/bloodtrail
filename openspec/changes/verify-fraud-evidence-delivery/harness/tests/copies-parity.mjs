// Test support: field-read parity scanner for copies probe (#839, Q184).
export function findDottedRoots(codeText) {
  const sanitized = codeText
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "");

  const regex = /(?<![\.\?a-zA-Z0-9_$])([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\.|\?\.)[a-zA-Z_$][a-zA-Z0-9_$]*/g;
  return new Set([...sanitized.matchAll(regex)].map((match) => match[1]));
}
