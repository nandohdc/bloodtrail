// Restart and read-back bookkeeping for the copies ingress role (#839, D2).
// The restart stays in-process and keeps ONE listening HTTP server.
import { join } from "node:path";
import { readBack } from "../lib/ingress.mjs";

export function reportReadBack({ state, storage }) {
  const records = state.server?.state.records ?? [];
  const serverState = state.server?.state ?? { lookups: new Map() };
  return {
    type: "read_back",
    records,
    read_back: readBack({ state: serverState, storage }),
    restarts: state.restarts ?? [],
  };
}

async function drainPendingRequests(server) {
  const pending = server?.state?.pending;
  if (pending) await Promise.all(pending);
}

function closeStoragePort(storage) {
  if (typeof storage?.close === "function") {
    storage.close();
    return true;
  }
  return false;
}

function reopenStoragePort({ storage, directory, collector }) {
  if (storage && directory) {
    return new collector.SqliteStorage({ location: join(directory, "collector.db") });
  }
  return null;
}

function recreateCollectorIngress({ state, collector }) {
  const storagePort = state.storage ? { port: state.storage, owners: state.owners } : undefined;
  return new collector.CollectorIngress({
    authenticator: new collector.SyntheticFixtureAuthenticator([state.token]),
    storage: storagePort,
  });
}

export async function restartIngress({ state, collector }) {
  await drainPendingRequests(state.server);
  const before_record_count = state.server ? state.server.state.records.length : 0;
  const storage_closed = closeStoragePort(state.storage);
  const reopened = reopenStoragePort({ storage: state.storage, directory: state.directory, collector });
  const storage_reopened = Boolean(reopened);
  if (reopened) state.storage = reopened;

  state.ingress = recreateCollectorIngress({ state, collector });
  if (state.server) {
    state.server.state.ingress = state.ingress;
  }

  const entry = { before_record_count, storage_closed, storage_reopened };
  state.restarts = state.restarts ?? [];
  state.restarts.push(entry);
  return state.server;
}
