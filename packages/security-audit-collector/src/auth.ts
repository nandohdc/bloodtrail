// Authentication interface and the single shipped implementation.
//
// NON-PRODUCTION: SyntheticFixtureAuthenticator verifies mock synthetic
// credentials against an explicitly constructed fixture table only. It is
// documented as non-production by requirement and by README; it selects no
// production credential system, secret management, or infrastructure.
//
// Authentication identifies a sender. It does not prove evidence truth,
// trust, or integrity (F5 of the #107 plan).

export type AuthenticationResult =
  | { readonly kind: "verified"; readonly identity: string }
  | {
      readonly kind: "rejected";
      readonly reason: "missing" | "malformed" | "invalid";
    };

export interface Authenticator {
  verify(credentials: unknown): AuthenticationResult;
}

export interface SyntheticCredential {
  readonly credential: string;
}

export class SyntheticFixtureAuthenticator implements Authenticator {
  readonly #fixtureTokens: ReadonlySet<string>;

  constructor(fixtureTokens: readonly string[]) {
    this.#fixtureTokens = new Set(fixtureTokens);
  }

  verify(credentials: unknown): AuthenticationResult {
    if (credentials === undefined || credentials === null) {
      return { kind: "rejected", reason: "missing" };
    }
    if (!isSyntheticCredential(credentials)) {
      return { kind: "rejected", reason: "malformed" };
    }
    if (!this.#fixtureTokens.has(credentials.credential)) {
      return { kind: "rejected", reason: "invalid" };
    }
    return { kind: "verified", identity: `synthetic:${credentials.credential}` };
  }
}

function isSyntheticCredential(value: unknown): value is SyntheticCredential {
  if (typeof value !== "object" || value === null) return false;
  const credential = (value as { readonly credential?: unknown }).credential;
  return typeof credential === "string";
}
