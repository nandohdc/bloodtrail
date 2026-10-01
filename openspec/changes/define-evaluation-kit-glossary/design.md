## Context

See `proposal.md`. The Node binding context's `CONTEXT.md` follows the repository's glossary format: one or
two sentences per term, what the term is rather than what it does, and an `_Avoid_` line naming the words
not to use. `docs/agents/domain.md` sets that format.

## Goals / Non-Goals

**Goals:**

- Define each evaluation term once, in the words the kit documents already use.
- Separate the HTTP audit sink from the delivery handoff. Evaluator documents name both.

**Non-Goals:**

- Changing any kit document, gate, source file or spec.
- Defining general programming terms, such as timeout or retry budget.
- Recording an ADR. Nothing here is hard to reverse.

## Decisions

### Extend the Node binding context, not a new context

The evaluation kit is built, gated and documented by the Node binding package. A new context would split
one package's vocabulary across two glossaries.

Rejected:

- **A new evaluation-kit context.** It owns no package, so `CONTEXT-MAP.md` could not name where it lives
  except by pointing back to the Node binding.
- **Definitions inside the kit's own documents.** Evaluator documents are prose for evaluators. The
  glossary is the repository's single place for terms, and `docs/agents/domain.md` sends agents there.

## Risks / Trade-offs

- **A definition drifts from the kit documents.** Each definition uses the documents' own words, and the
  kit v2 fold (#667) is the next change that touches both.

## Migration Plan

Merge the glossary. Nothing depends on it at runtime.
