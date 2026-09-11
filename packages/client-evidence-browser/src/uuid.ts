import { CapabilityMissingError } from "./errors.js";

function resolveCrypto(cryptoObj?: Crypto): Crypto | undefined {
  if (cryptoObj !== undefined) {
    return cryptoObj;
  }
  if (typeof globalThis !== "undefined") {
    return globalThis.crypto;
  }
  return undefined;
}

function hasGetRandomValues(cryptoInstance: Crypto | undefined | null): boolean {
  if (!cryptoInstance) {
    return false;
  }
  return typeof cryptoInstance.getRandomValues === "function";
}

function byteToHex(byte: number): string {
  return byte.toString(16).padStart(2, "0");
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, byteToHex);
  const p1 = hex.slice(0, 4).join("");
  const p2 = hex.slice(4, 6).join("");
  const p3 = hex.slice(6, 8).join("");
  const p4 = hex.slice(8, 10).join("");
  const p5 = hex.slice(10, 16).join("");
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

export function generateInteractionId(cryptoObj?: Crypto): string {
  const cryptoInstance = resolveCrypto(cryptoObj);
  if (!hasGetRandomValues(cryptoInstance)) {
    throw new CapabilityMissingError(
      "crypto.getRandomValues is required to generate secure interaction identifiers"
    );
  }
  const bytes = new Uint8Array(16);
  cryptoInstance!.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return formatUuid(bytes);
}
