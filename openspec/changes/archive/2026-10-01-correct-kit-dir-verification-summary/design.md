## Context

See `proposal.md`. `checkEvaluationKit` runs in two modes:

- **With no `kitDir`,** it builds a verification kit from the working tree's tracked files. At step 2 it
  rebuilds that kit twice from a copy, the second time with stale output and untracked files planted, to
  prove the identity reproduces.
- **With a `kitDir`,** it checks that kit as given, and step 2 is skipped.

Every other step runs in both modes. Most planted-defect controls run the gate in the second mode, on a
disposable copy of one base kit.

## Goals / Non-Goals

**Goals:**

- The success line names only checks that ran, in both modes.
- A control proves it, in the run of `test:kit-controls`.

**Non-Goals:**

- Changing any gate check, planted-defect control, kit file or document.
- Rebuilding a kit given with `--kit-dir`. To reproduce a distributable kit, build it from clean clones of its
  commit, as #664 did.
- Recording an ADR. Nothing here is hard to reverse.

## Decisions

### One flag decides both the rebuild and the claim

`checkEvaluationKit` derives one flag from whether a kit directory was given. The flag decides whether the
gate builds a kit, whether step 2 runs, and which identity clause the success line carries, so the claim
cannot drift from the check.

### The gate returns its success line

`checkEvaluationKit` returns the line instead of writing it, and the command-line entry point prints it. This
has two effects:

- A control can read the line from a passing run without capturing the process's standard output.
- The controls, which import the function, print no gate success line of their own.

### A null control outside the planted-defect list

The control harness reports "N of N planted defects applied, and each failed closed". A passing run is not a
planted defect, so the null control:

- runs before the planted-defect controls;
- is reported on its own, which keeps that count true;
- shows that an unmodified kit copy passes in the mode most planted-defect controls use, so each failure
  belongs to its planted defect.

### Rejected

- **Rebuilding under `--kit-dir`.** It would change what the gate checks, and it needs a clean checkout of the
  identity commit.
- **Dropping the reproduction clause in both modes.** A run that builds its own kit does reproduce the
  identity, and dropping the clause would hide a check that ran.

## Risks / Trade-offs

- **The controls take one more gate run.** It is a `--kit-dir` run, which skips the two rebuilds. Its local
  timing is recorded in the implementation pull request.

## Migration Plan

Merge. No script, gate or workflow reads the success line.
