// Bundled runtime helper, MIT licensed.
// Source: node_modules/ajv/dist/runtime/ucs2length.js (ajv 8.20.0), lines 3-21.
// https://github.com/ajv-validator/ajv
// Inlined by scripts/generate-contract.mjs into
// src/generated/schema-validator.generated.cjs per ADR-SDK-011.
//
// Adapted from the upstream source: control flow is restructured into
// single-branch conditions (no logical operators) so the bundled code stays
// within the repository's analyzer branch thresholds, while remaining
// behavior-identical to the pinned implementation. Behavior identity is
// enforced by tests/verification/bundled-formats-parity.test.mjs.
// https://mathiasbynens.be/notes/javascript-encoding
// https://github.com/bestiejs/punycode.js - punycode.ucs2.decode
function ucs2length(str) {
    const len = str.length;
    let length = 0;
    let pos = 0;
    let value;
    while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value < 0xd800)
            continue;
        if (value > 0xdbff)
            continue;
        if (pos >= len)
            continue;
        // high surrogate, and there is a next character
        value = str.charCodeAt(pos);
        if ((value & 0xfc00) === 0xdc00)
            pos++; // low surrogate
    }
    return length;
}
const bundledUcs2length = ucs2length;

export { bundledUcs2length };
