// Implementer-default positive controls, separate from #804's 39 case rows.
// Counts include capture construction, Node factory, every constructor/method
// and sink callback. Source at corrected_at: context.ts:139-166,248-323;
// events.ts:209-225; operations.ts:108,212-222; testing.ts:21-33.
export const BASELINE_PLAN = [
  { case_id: "B-LOGOUT", predicted_calls: 13, steps: [
    { id: "begin", accepted: true, sink_count: 0 },
    { id: "mark", accepted: true, sink_count: 0 },
    { id: "emit", accepted: true, sink_count: 1 },
  ] },
  { case_id: "B-MFA", predicted_calls: 9, steps: [
    { id: "emit", accepted: true, sink_count: 1 },
  ] },
];
