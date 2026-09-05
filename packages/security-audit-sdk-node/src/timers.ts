import type { AuditTimerHandle, AuditTimerProvider } from "@bloodtrail/security-audit-sdk-core";

export interface NodeTimerHandle extends AuditTimerHandle {
  readonly raw: ReturnType<typeof setTimeout>;
  unref(): void;
}

const timerHandleMap = new WeakMap<AuditTimerHandle, ReturnType<typeof setTimeout>>();

export const nodeTimers: AuditTimerProvider = Object.freeze({
  setTimeout(callback: () => void, ms: number): AuditTimerHandle {
    const raw = setTimeout(callback, ms);
    const handle: NodeTimerHandle = {
      raw,
      unref(): void {
        raw.unref();
      },
    };
    timerHandleMap.set(handle, raw);
    return handle;
  },
  clearTimeout(handle: AuditTimerHandle): void {
    if (!handle) return;
    const raw = timerHandleMap.get(handle) ?? (handle as Partial<NodeTimerHandle>).raw ?? (handle as unknown as ReturnType<typeof setTimeout>);
    if (raw) {
      clearTimeout(raw);
    }
  },
});
