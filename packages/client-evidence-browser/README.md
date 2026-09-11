# @bloodtrail/client-evidence-browser

Browser client evidence collection package for interaction-scoped audit correlation (P1).

## Scope and Assurance Limitations

- **Web APIs only:** Built strictly on the Web Cryptography API. Zero Node built-in imports, zero third-party dependencies, zero SDK Core imports.
- **No transport:** Never transmits or persists data; constructs low-assurance `ClientEvidenceEnvelope` v1 objects and returns them to the host application.
- **No storage:** Never writes to `localStorage`, `sessionStorage`, `document.cookie`, or `indexedDB`.
- **Low-assurance trust floor:** All claims carry `client_claim` trust. Client evidence cannot prove genuine browser or device presence, or that the host application did not fabricate claims.
