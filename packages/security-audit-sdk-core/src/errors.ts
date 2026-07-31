import { SDK_ERROR_CODES } from "./generated/contract.generated.js";
import type { AuditErrorCode, SdkGeneratedErrorCode } from "./generated/contract.generated.js";
import { boundedPath } from "./internal.js";

export type AuditErrorCategory = "configuration" | "validation" | "authority" | "privacy" | "lifecycle" | "sink";
export type SdkErrorCode = SdkGeneratedErrorCode;

export interface SafeAuditError {
  readonly code: AuditErrorCode | string;
  readonly category: AuditErrorCategory;
  readonly path?: string;
  readonly eventName?: string;
  readonly eventId?: string;
}

export type AuditResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SafeAuditError };

export class SecurityAuditSdkError extends Error {
  readonly code: AuditErrorCode | string;
  readonly category: AuditErrorCategory;
  readonly path: string | undefined;

  constructor(code: AuditErrorCode | string, category: AuditErrorCategory, path?: string) {
    super(code);
    this.name = "SecurityAuditSdkError";
    this.code = code;
    this.category = category;
    this.path = path;
  }

  toJSON(): SafeAuditError {
    return this.path === undefined
      ? { code: this.code, category: this.category }
      : { code: this.code, category: this.category, path: boundedPath(this.path) };
  }
}

export function failure(
  code: AuditErrorCode | string,
  category: AuditErrorCategory,
  path?: string,
  metadata?: { readonly eventName?: string; readonly eventId?: string },
): AuditResult<never> {
  const error: SafeAuditError = path === undefined ? { code, category } : { code, category, path: boundedPath(path) };
  if (metadata?.eventName !== undefined || metadata?.eventId !== undefined) {
    return {
      ok: false,
      error: {
        ...error,
        ...(metadata.eventName === undefined ? {} : { eventName: boundedPath(metadata.eventName) }),
        ...(metadata.eventId === undefined ? {} : { eventId: boundedPath(metadata.eventId) }),
      },
    };
  }
  return { ok: false, error };
}

export { SDK_ERROR_CODES };
