import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BoundsExceededError,
  CapabilityMissingError,
  ForbiddenClaimError,
  InvalidInteractionKindError,
  InvalidNonceError,
  buildClientEvidenceEnvelope,
  startInteraction
} from "../dist/index.js";
// @ts-expect-error Untyped contract validator module
import { validateEnvelope } from "../../../contracts/client-evidence-envelope/scripts/validate-envelope.mjs";

const VALID_NONCE_32 = "0123456789abcdef0123456789abcdef";
const VALID_NONCE_64 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("client-evidence-browser SDK", () => {
  describe("Supported interaction lifecycle", () => {
    it("creates a canonical interaction and builds valid envelope", () => {
      const interaction = startInteraction("button_click");
      assert.match(interaction.id, UUID_V4_REGEX);
      assert.equal(interaction.interactionKind, "button_click");
      assert.equal(interaction.platform, "web_browser");
      assert.ok(interaction.clientTimestamp >= 1700000000000);

      interaction.addClaim("target_element", "checkout-button");
      interaction.addClaim("click_count", 1);
      interaction.addClaim("is_primary", true);

      const envelope = interaction.toEnvelope();
      assert.equal(envelope.envelope_version, 1);
      assert.equal(envelope.interaction_id, interaction.id);
      assert.equal(envelope.interaction_kind, "button_click");
      assert.equal(envelope.provenance.source, "client_reported");
      assert.equal(envelope.provenance.trust_level, "client_claim");
      assert.equal(envelope.provenance.platform, "web_browser");
      assert.equal(envelope.provenance.capture_scope, "interaction_ephemeral");
      assert.equal(envelope.claims?.length, 3);

      const validation = validateEnvelope(envelope);
      assert.equal(validation.valid, true, `Envelope failed contract validation: ${JSON.stringify(validation.errors)}`);
    });

    it("supports Mode A nonce attachment and validates against contract", () => {
      const interaction = startInteraction("navigation", {
        nonce: VALID_NONCE_32
      });
      assert.equal(interaction.nonce, VALID_NONCE_32);

      const envelope = interaction.toEnvelope();
      assert.equal(envelope.nonce, VALID_NONCE_32);

      const validation = validateEnvelope(envelope);
      assert.equal(validation.valid, true);
    });

    it("supports 64-character hex nonce", () => {
      const interaction = startInteraction("form_submit", {
        nonce: VALID_NONCE_64
      });
      assert.equal(interaction.nonce, VALID_NONCE_64);
      const envelope = interaction.toEnvelope();
      const validation = validateEnvelope(envelope);
      assert.equal(validation.valid, true);
    });

    it("supports buildClientEvidenceEnvelope helper directly", () => {
      const envelope = buildClientEvidenceEnvelope({
        interactionKind: "dialog_action",
        nonce: VALID_NONCE_32,
        claims: {
          action: "confirm",
          modal_id: "delete-modal"
        }
      });
      assert.equal(envelope.interaction_kind, "dialog_action");
      assert.equal(envelope.claims?.length, 2);
      const validation = validateEnvelope(envelope);
      assert.equal(validation.valid, true);
    });

    it("serializes envelope within max bounds", () => {
      const interaction = startInteraction("custom");
      interaction.addClaim("custom_event", "theme_toggle");
      const serialized = interaction.serialize();
      assert.ok(typeof serialized === "string");
      const parsed = JSON.parse(serialized);
      assert.equal(parsed.interaction_kind, "custom");
    });

    it("generates unique interaction IDs across invocations without reuse", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const interaction = startInteraction("input");
        assert.ok(!ids.has(interaction.id), `Duplicate interaction ID generated: ${interaction.id}`);
        ids.add(interaction.id);
      }
      assert.equal(ids.size, 50);
    });
  });

  describe("Missing browser capabilities", () => {
    it("throws CapabilityMissingError when crypto has no getRandomValues", () => {
      const mockCrypto = {} as unknown as Crypto;
      assert.throws(
        () => startInteraction("button_click", undefined, mockCrypto),
        CapabilityMissingError
      );
    });

    it("throws CapabilityMissingError when crypto is completely absent", () => {
      const emptyObj = null as unknown as Crypto;
      assert.throws(
        () => startInteraction("button_click", undefined, emptyObj),
        CapabilityMissingError
      );
    });
  });

  describe("Forbidden claims rejection", () => {
    const forbiddenClaims = [
      "user_agent",
      "url",
      "path",
      "query",
      "cookie",
      "ip",
      "fingerprint",
      "session_id",
      "account_id",
      "user_id",
      "auth_token",
      "credential",
      "screen",
      "dom_content",
      "form_value",
      "geolocation",
      "hardware",
      "locale",
      "location",
      "risk_score",
      "timezone",
      "verdict",
      "decision",
      "device_id"
    ];

    for (const claim of forbiddenClaims) {
      it(`rejects forbidden claim '${claim}' in addClaim`, () => {
        const interaction = startInteraction("refresh");
        assert.throws(
          () => interaction.addClaim(claim, "val"),
          ForbiddenClaimError
        );
      });

      it(`rejects forbidden claim '${claim}' in initial options`, () => {
        assert.throws(
          () => startInteraction("refresh", { claims: { [claim]: "val" } }),
          ForbiddenClaimError
        );
      });
    }
  });

  describe("Bounds enforcement", () => {
    it("rejects invalid interaction kind", () => {
      assert.throws(
        () => startInteraction("invalid_kind" as unknown as "custom"),
        InvalidInteractionKindError
      );
    });

    it("rejects non-string interaction kind", () => {
      assert.throws(
        () => startInteraction(123 as unknown as "custom"),
        InvalidInteractionKindError
      );
    });

    it("rejects empty claim name", () => {
      const interaction = startInteraction("tab_switch");
      assert.throws(
        () => interaction.addClaim("", "value"),
        BoundsExceededError
      );
    });

    it("rejects claim name exceeding 32 characters", () => {
      const interaction = startInteraction("tab_switch");
      const longName = "a".repeat(33);
      assert.throws(
        () => interaction.addClaim(longName, "value"),
        BoundsExceededError
      );
    });

    it("rejects claim string value exceeding 128 characters", () => {
      const interaction = startInteraction("tab_switch");
      const longVal = "v".repeat(129);
      assert.throws(
        () => interaction.addClaim("safe_name", longVal),
        BoundsExceededError
      );
    });

    it("rejects more than 8 claims in addClaim", () => {
      const interaction = startInteraction("tab_switch");
      for (let i = 1; i <= 8; i++) {
        interaction.addClaim(`c_${i}`, i);
      }
      assert.throws(
        () => interaction.addClaim("c_9", 9),
        BoundsExceededError
      );
    });

    it("rejects more than 8 claims in initial options", () => {
      const claims: Record<string, number> = {};
      for (let i = 1; i <= 9; i++) {
        claims[`claim_${i}`] = i;
      }
      assert.throws(
        () => startInteraction("tab_switch", { claims }),
        BoundsExceededError
      );
    });

    it("rejects nonce shorter than 32 characters", () => {
      assert.throws(
        () => startInteraction("navigation", { nonce: "0123456789abcdef" }),
        InvalidNonceError
      );
    });

    it("rejects nonce longer than 64 characters", () => {
      assert.throws(
        () => startInteraction("navigation", { nonce: "a".repeat(65) }),
        InvalidNonceError
      );
    });

    it("rejects nonce with uppercase characters", () => {
      assert.throws(
        () => startInteraction("navigation", { nonce: "0123456789ABCDEF0123456789ABCDEF" }),
        InvalidNonceError
      );
    });

    it("rejects nonce with non-hex characters", () => {
      assert.throws(
        () => startInteraction("navigation", { nonce: "0123456789abcdef0123456789zzzzzz" }),
        InvalidNonceError
      );
    });
  });

  describe("Malicious host inputs", () => {
    it("rejects non-primitive / object claim values", () => {
      const interaction = startInteraction("custom");
      assert.throws(
        () => interaction.addClaim("obj", { evil: true } as unknown as string),
        /Claim value must be a string, number, or boolean/
      );
    });

    it("rejects non-finite number claim values", () => {
      const interaction = startInteraction("custom");
      assert.throws(
        () => interaction.addClaim("nan_val", Number.NaN),
        BoundsExceededError
      );
      assert.throws(
        () => interaction.addClaim("inf_val", Number.POSITIVE_INFINITY),
        BoundsExceededError
      );
    });

    it("does not pollute Object prototype with prototype keys", () => {
      const interaction = startInteraction("custom");
      interaction.addClaim("normal", "ok");
      assert.equal((Object.prototype as unknown as Record<string, unknown>)["normal"], undefined);
    });
  });
});
