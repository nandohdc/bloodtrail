// Test support, not a test file: the dotted field reads a role makes of one input object. A role may read
// that object no other way (no destructuring, bracket or optional-chain read), so the scan sees every read.
import assert from "node:assert/strict";

export function dottedReads({ text, name }) {
  assert.doesNotMatch(text, new RegExp(`=\\s*${name}\\b(?!\\s*\\.)|\\b${name}\\s*\\[|${name}\\?\\.`), `${name} is read other than by dotted access`);
  return new Set([...text.matchAll(new RegExp(`\\b${name}((?:\\.[a-z0-9_]+)+)`, "g"))].map((match) => match[1].slice(1)));
}

export function resolves({ object, path }) {
  return path.split(".").reduce((value, key) => value?.[key], object) !== undefined;
}
