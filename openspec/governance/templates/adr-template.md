# ADR <n> — <title>

- **Status:** proposed | accepted | superseded by ADR <n>
- **Change:** `<change-id>`
- **Assessment:** `<path to the assessment carrying the governance metadata>`
- **Catalog version:** 1.0.0
- **Decision:** `direct_implementation` | `named_pattern`
- **Selected pattern IDs:** `<none, or pattern-…>`
- **Security sensitive:** true | false
- **Schema version:** 1.1

## Context

<The situation that forces a decision. State the architectural forces concretely enough that someone
can disagree with the conclusion on the evidence.>

## Decision

<What was decided, in one paragraph.>

## Candidate approaches considered

| Approach | Kind | Forces addressed | Outcome |
| --- | --- | --- | --- |
| `approach-direct-<name>` | direct implementation | <forces> | selected / rejected |
| `approach-<alternative>` | alternative | <forces> | selected / rejected |

Every rejection cites forces. Popularity, familiarity, and "best practice" are not reasons.

## Invariants bound

| Invariant ID | Kind | Evidence |
| --- | --- | --- |
| `<invariant-id>` | required / conditional / implementation | `<test or fixture>` |

For a named pattern, every required invariant of the selected catalog version appears here. A
conditional invariant declared non-applicable carries a force-based reason and is acknowledged in the
signed governance record.

## Security and compatibility

- **Applicable security dimensions:** <list, or the justification for `security_sensitive: false`>
- **Schema compatibility:** <current version, and any migration this decision requires>
- **Reduced assurance:** <state plainly if any part of this rests on a retrospective exception,
  a grandfathered scope, or an emergency classification — including what that costs>

## Consequences

<What becomes easier, what becomes harder, and what now has to be maintained.>

## Re-evaluation triggers

<The observable conditions that would reopen this decision.>
