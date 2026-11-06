// Planted-defect controls for the copies probe (#839, criterion 8, Q113).
// Executed by live senders before emitting probe traffic.
import { sha256 } from "../lib/io.mjs";
import {
  conflictRefusalObserver,
  duplicateAcknowledgmentObserver,
  volumeDuplicatesObserver,
} from "./evaluate.mjs";

function makeConflictFixture(origHash, changedHash, outcomeKind) {
  return {
    sender: { exchanges: [{ event_id: "evt_c09", attempt: 0, body_sha256: origHash }] },
    ingress: {
      records: [{ event_id: "evt_c09", occurrence: 1, attempt: 0, body_sha256: changedHash, outcome: { kind: outcomeKind, code: "COLLECTOR_STORAGE_CONFLICT" } }],
      read_back: [{ event_id: "evt_c09", persisted: true, stored_body_sha256: origHash }],
    },
  };
}

function makeDuplicateFixture(origHash, secondOutcomeKind) {
  const records = [
    { event_id: "evt_dup", occurrence: 1, attempt: 0, body_sha256: origHash, outcome: { kind: "persisted" } },
    { event_id: "evt_dup", occurrence: 1, attempt: 0, body_sha256: origHash, outcome: { kind: secondOutcomeKind } },
  ];
  return {
    sender: {
      calls: [{ ok: true }, { ok: true }],
      exchanges: [
        { event_id: "evt_dup", attempt: 0, body_sha256: origHash },
        { event_id: "evt_dup", attempt: 0, body_sha256: origHash },
      ],
      delivery_log: [
        { event_id: "evt_dup", status: "acknowledged" },
        { event_id: "evt_dup", status: "acknowledged" },
      ],
    },
    ingress: { records, read_back: [{ event_id: "evt_dup", persisted: true, stored_body_sha256: origHash }] },
  };
}

function checkChangedByteDefect(origHash, changedHash) {
  const c04Planted = conflictRefusalObserver({ observed: { identities: makeConflictFixture(origHash, changedHash, "persisted") } });
  return c04Planted?.conflict_rejected === false;
}

function checkDoubleCountDefect(origHash) {
  const dupPlanted = makeDuplicateFixture(origHash, "persisted");
  const c03Planted = duplicateAcknowledgmentObserver({ observed: { identities: dupPlanted } });
  const c11Planted = volumeDuplicatesObserver({ observed: { duplicates_volume: dupPlanted } });
  const c03Readmitted = c03Planted?.readmitted === true;
  const c11Inflated = (c11Planted?.duplicate_inflation ?? 0) > 0;
  return c03Readmitted && c11Inflated;
}

function checkNullControls(origHash, changedHash) {
  const c04Null = conflictRefusalObserver({ observed: { identities: makeConflictFixture(origHash, changedHash, "rejected") } });
  const dupNull = makeDuplicateFixture(origHash, "duplicate");
  const c03Null = duplicateAcknowledgmentObserver({ observed: { identities: dupNull } });
  const c11Null = volumeDuplicatesObserver({ observed: { duplicates_volume: dupNull } });
  const c04Pass = c04Null?.conflict_rejected === true;
  const c03Pass = c03Null?.readmitted === false && c03Null?.stored_count === 1;
  const c11Pass = c11Null?.duplicate_inflation === 0;
  return c04Pass && c03Pass && c11Pass;
}

export function copiesControls() {
  const origHash = sha256(JSON.stringify({ event: { id: "evt_c09" }, data: { port: 443 } }));
  const changedHash = sha256(JSON.stringify({ event: { id: "evt_c09" }, data: { port: 444 } }));

  const changedByte = checkChangedByteDefect(origHash, changedHash);
  const doubleCount = checkDoubleCountDefect(origHash);
  const nullPass = checkNullControls(origHash, changedHash);
  const holds = changedByte === true && doubleCount === true && nullPass === true;

  return {
    changed_byte_defect_detected: changedByte,
    duplicate_double_count_defect_detected: doubleCount,
    null_controls_pass: nullPass,
    holds,
  };
}
