import { codePointCompare as compareKeys } from "../chains/reconstruct.mjs";

// The shared comparator orders JS strings. Fixed-width ASCII keys preserve Unicode code-point order.
const codePointKey = (value) => Array.from(value, (character) => character.codePointAt(0).toString(16).padStart(6, "0")).join("");

export function codePointCompare(left, right) {
  if (!/[\uD800-\uDFFF]/.test(left + right)) return compareKeys(left, right);
  return compareKeys(codePointKey(left), codePointKey(right));
}
