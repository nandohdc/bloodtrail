// Bundled runtime helper, MIT licensed.
// Source: node_modules/ajv/dist/runtime/ucs2length.js (ajv 8.20.0), lines 3-21.
// https://github.com/ajv-validator/ajv
// Inlined by scripts/generate-contract.mjs into
// src/generated/schema-validator.generated.cjs per ADR-SDK-011.
// Do not restructure: verbatim transcription is guarded by
// tests/verification/bundled-formats-parity.test.mjs.
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
        if (value >= 0xd800 && value <= 0xdbff && pos < len) {
            // high surrogate, and there is a next character
            value = str.charCodeAt(pos);
            if ((value & 0xfc00) === 0xdc00)
                pos++; // low surrogate
        }
    }
    return length;
}
const bundledUcs2length = ucs2length;

export { bundledUcs2length };
