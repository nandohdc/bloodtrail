// GENERATED FILE. DO NOT EDIT.
// Contract: Bloodtrail Security Audit Event Contract 1.0.0
// Sources: contracts/security-audit/source/contract.source.json and generated contract artifacts.
interface StandaloneValidationError {
  readonly instancePath: string;
  readonly schemaPath: string;
  readonly keyword: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly message?: string;
}

interface StandaloneValidate {
  (value: unknown): boolean;
  errors: readonly StandaloneValidationError[] | null;
}

declare const validate: StandaloneValidate;
export = validate;
