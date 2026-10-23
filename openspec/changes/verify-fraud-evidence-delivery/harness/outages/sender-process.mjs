// Sender role for the Stage 2 outages probe (#837): the tracer's sender role, unchanged. The session hands
// it one pass at a time as an expectations view (composition, clock, workload seed and occurrences, and
// that pass's call budget), so it emits the pass's occurrences in order through the reference composition.
// The role guard is the first import, so it is installed before the kit modules evaluate.
import "../lib/role-guard.mjs";
import "../tracer/sender-process.mjs";
