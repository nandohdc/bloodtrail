// Ingress role for the Stage 2 load probe (#838): the tracer's ingress role, unchanged. Each phase starts a
// fresh one with its own SQLite file and that phase's scheduled fault plan. The role guard is the first
// import, so it is installed before the kit module evaluates.
import "../lib/role-guard.mjs";
import "../tracer/ingress-process.mjs";
