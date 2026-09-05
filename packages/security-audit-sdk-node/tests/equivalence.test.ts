import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nodeClock,
  nodeIdentifiers,
  nodeByteLength,
  nodeTimers,
  nodeContextProvider,
  nodeSchemaRuntime,
  nodePlatformProvider,
  createNodeSecurityAuditSdk,
} from "../dist/index.js";
import {
  CONTRACT_VERSION,
  createAuditContextFrame,
  authoritativeActor,
  authoritativeTenant,
  utf8ByteLength,
  type AuditEventSink,
  type SecurityAuditEvent,
} from "@bloodtrail/security-audit-sdk-core";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("Node SPI implementations equivalence", () => {
  describe("nodeIdentifiers", () => {
    it("generates valid RFC 4122 v4 UUIDs for all 7 identifier kinds", () => {
      const kinds = [
        nodeIdentifiers.eventId(),
        nodeIdentifiers.operationId(),
        nodeIdentifiers.correlationId(),
        nodeIdentifiers.causationId(),
        nodeIdentifiers.requestId(),
        nodeIdentifiers.messageId(),
        nodeIdentifiers.transactionId(),
      ];

      for (const id of kinds) {
        assert.match(id, UUID_V4_REGEX);
      }

      // Check uniqueness across consecutive generations
      const set = new Set(kinds);
      assert.equal(set.size, kinds.length);
    });
  });

  describe("nodeClock", () => {
    it("returns current Date reflecting system time", () => {
      const before = Date.now();
      const date = nodeClock.now();
      const after = Date.now();

      assert.ok(date instanceof Date);
      assert.ok(date.getTime() >= before);
      assert.ok(date.getTime() <= after);
    });
  });

  describe("nodeByteLength", () => {
    it("measures exact UTF-8 byte lengths matching Buffer and Core fallback", () => {
      const samples = [
        "",
        "hello world",
        "föö bär",
        "こんにちは世界",
        "🔐 security-audit 🛡️",
        "A".repeat(10_000),
      ];

      for (const sample of samples) {
        const expected = Buffer.byteLength(sample, "utf8");
        const actual = nodeByteLength.byteLength(sample);
        assert.equal(actual, expected);
        assert.equal(actual, utf8ByteLength(sample));
      }
    });
  });

  describe("nodeTimers", () => {
    it("schedules, executes, and supports handle unreferencing", async () => {
      let executed = false;
      const handle = nodeTimers.setTimeout(() => {
        executed = true;
      }, 10);

      assert.equal(typeof handle.unref, "function");
      handle.unref!();

      await new Promise((resolve) => setTimeout(resolve, 30));
      assert.equal(executed, true);
    });

    it("clears scheduled timeouts idempotently", async () => {
      let executed = false;
      const handle = nodeTimers.setTimeout(() => {
        executed = true;
      }, 15);

      nodeTimers.clearTimeout(handle);
      await new Promise((resolve) => setTimeout(resolve, 30));
      assert.equal(executed, false);

      // Clearing again should not throw
      nodeTimers.clearTimeout(handle);
    });
  });

  describe("nodeContextProvider", () => {
    it("returns undefined outside active context scope", () => {
      assert.equal(nodeContextProvider.get(), undefined);
    });

    it("propagates context within active scope and restores parent scope upon exit", () => {
      const outerFrame = createAuditContextFrame({
        actor: authoritativeActor({ id: "outer-user", type: "authenticated_human" }),
        tenant: authoritativeTenant({ scope: "tenant", effective_tenant_id: "tenant-1", resource_tenant_id: "tenant-1" }),
      });

      const innerFrame = createAuditContextFrame({
        actor: authoritativeActor({ id: "inner-service", type: "service_account" }),
        tenant: authoritativeTenant({ scope: "tenant", effective_tenant_id: "tenant-2", resource_tenant_id: "tenant-2" }),
      });

      assert.equal(nodeContextProvider.get(), undefined);

      nodeContextProvider.run(outerFrame, () => {
        assert.equal(nodeContextProvider.get(), outerFrame);

        nodeContextProvider.run(innerFrame, () => {
          assert.equal(nodeContextProvider.get(), innerFrame);
        });

        assert.equal(nodeContextProvider.get(), outerFrame);
      });

      assert.equal(nodeContextProvider.get(), undefined);
    });
  });

  describe("nodeSchemaRuntime", () => {
    it("returns ok for canonical event structures and fails for invalid payloads", async () => {
      const { readFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      const contractPath = resolve(process.cwd(), "../../contracts/security-audit/examples/positive/all-events.json");
      const events = JSON.parse(await readFile(contractPath, "utf8")) as SecurityAuditEvent[];
      const validEvent = events[0]!;

      const validResult = nodeSchemaRuntime.validate(validEvent);
      assert.equal(validResult.ok, true);

      const invalidResult = nodeSchemaRuntime.validate({ invalid: true });
      assert.equal(invalidResult.ok, false);
    });
  });

  describe("createNodeSecurityAuditSdk", () => {
    it("initializes an SDK instance with node platform defaults", async () => {
      const { readFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      const contractPath = resolve(process.cwd(), "../../contracts/security-audit/examples/positive/all-events.json");
      const events = JSON.parse(await readFile(contractPath, "utf8")) as SecurityAuditEvent[];
      const validEvent = events[0]!;

      const emittedEvents: SecurityAuditEvent[] = [];
      const sink: AuditEventSink = {
        async emit(event) {
          emittedEvents.push(event);
          return { status: "accepted" };
        },
      };

      const sdk = createNodeSecurityAuditSdk({
        contractVersion: CONTRACT_VERSION,
        producer: validEvent.producer,
        service: validEvent.service,
        environment: validEvent.environment,
        sink,
      });

      assert.equal(sdk.state, "ready");

      const result = await sdk.emit(validEvent);
      assert.equal(result.ok, true);
      assert.equal(emittedEvents.length, 1);

      await sdk.shutdown();
      assert.equal(sdk.state, "shut_down");
    });
  });
});
