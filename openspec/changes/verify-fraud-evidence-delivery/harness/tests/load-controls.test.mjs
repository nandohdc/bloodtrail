import assert from "node:assert/strict";
import { test } from "node:test";
import { accountingControls } from "../load/controls.mjs";

test("runtime accounting controls reject each planted defect and accept their nulls without SDK calls", () => {
  assert.deepEqual(accountingControls(), {
    retry_delay_missing_detected: true, retry_exhaustion_missing_detected: true, storage_absence_missing_detected: true, retry_null_control_holds: true,
    omitted_admission_detected: true, uncounted_drop_detected: true, duplicate_drop_detected: true,
    silent_ceiling_detected: true, late_ceiling_detected: true,
    missing_occurrence_detected: true, deadline_overrun_detected: true, late_rejection_alert_detected: true,
    null_controls_hold: true, holds: true,
  });
});
