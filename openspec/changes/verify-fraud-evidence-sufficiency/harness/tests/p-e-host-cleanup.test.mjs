import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { withHostDatabase } from "../p-e/host.mjs";
import { hostSink } from "../p-e/sink.mjs";
import { EVENT, scratchDirectory } from "./p-e-host-fixtures.mjs";

const FAULT = new TypeError("pe-sink-fault");

const WORKLOADS = [
  {
    name: "success",
    returns: "committed",
    work(host) {
      host.begin();
      host.insertBusiness({ id: "pe-biz-clean" });
      host.commit();
      return "committed";
    },
  },
  {
    name: "rollback",
    work(host) {
      host.begin();
      host.insertBusiness({ id: "pe-biz-clean" });
      host.rollback();
    },
  },
  {
    name: "thrown setup",
    throws: /pe-setup-failure/,
    work() {
      throw new Error("pe-setup-failure");
    },
  },
  {
    name: "sink fault",
    throws: /pe-sink-fault/,
    async work(host) {
      await hostSink({ host, fault: FAULT }).emit(EVENT);
    },
  },
  {
    name: "deferred completion",
    async work(host) {
      const sink = hostSink({ host, deferred: true });
      host.begin();
      const pending = sink.emit(EVENT);
      host.commit();
      await pending;
    },
  },
  {
    name: "open transaction",
    work(host) {
      host.begin();
      host.insertBusiness({ id: "pe-biz-clean" });
    },
  },
];

for (const row of WORKLOADS) {
  test(`withHostDatabase removes the per-case file and closes the connection after ${row.name}`, async (t) => {
    const directory = scratchDirectory(t, "pe-host-cleanup-");
    let opened;
    const run = () => withHostDatabase({ directory, name: "case", work: (host) => {
      opened = host;
      return row.work(host);
    } });
    let value;
    if (row.throws) await assert.rejects(run(), row.throws);
    else value = await run();
    assert.equal(existsSync(join(directory, "case.sqlite")), false);
    assert.equal(opened.closed, true);
    assert.equal(opened.isOpen, false);
    if (row.returns !== undefined) assert.equal(value, row.returns);
  });
}

test("withHostDatabase rethrows only the work error and still removes the file", async (t) => {
  const directory = scratchDirectory(t, "pe-host-cleanup-");
  const fault = new Error("pe-rethrow-fixture");
  await assert.rejects(withHostDatabase({ directory, name: "case", work: () => {
    throw fault;
  } }), (error) => error === fault);
  assert.equal(existsSync(join(directory, "case.sqlite")), false);
});
