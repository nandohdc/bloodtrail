import { AsyncLocalStorage } from "node:async_hooks";
import type { AuditContextFrame, ContextProvider } from "@bloodtrail/security-audit-sdk-core";

export class NodeContextProvider implements ContextProvider {
  readonly #storage = new AsyncLocalStorage<AuditContextFrame>();

  run<R>(context: AuditContextFrame, fn: () => R): R {
    return this.#storage.run(context, fn);
  }

  get(): AuditContextFrame | undefined {
    return this.#storage.getStore();
  }
}

export const nodeContextProvider: ContextProvider = new NodeContextProvider();
