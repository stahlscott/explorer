# Verification status

What has actually been measured, and what has not. Read this before trusting any
rule in the skill, and update it when a rule gets tested.

The corpus those measurements ran against is deliberately not in this repository
— it analysed a private codebase — so this file is the only surviving record of
what was established. Losing it means starting the measurement over.

Last updated: 2026-09-12.

## The tool is verified

116 unit tests and 22 browser tests, all of which run from a fresh clone with no
access to any particular repository. The browser suite builds its own git
repositories and renders a document over them, so the byte-identity test — the
one that proves cited lines match the tree at the pinned SHA — compares against
bytes the suite itself wrote.

Confirmed by clone-and-run, not by inspection: an earlier version of that suite
rendered a real document against the author's own checkouts and therefore passed
only on one machine, which went unnoticed for weeks because it never failed.

Two behaviours were found in the wild rather than in tests, and both now have
tests: a branch that moved off its pinned SHA (`moved-head`, which fired on a
force-push hours after a document was written), and a worktree listed at the
pinned SHA whose directory had been deleted.

## The skill is measured only in part

The skill's rules came from observed failures, not from speculation. But most of
them have been observed *failing* without the rule, and only some have been
observed *working* with it.

### Measured

| Rule | Evidence |
|---|---|
| Account for every changed path; a path outside the feature's directories is a finding until opened | Three cold runs missed an app-wide stylesheet change 0/3 without it; three later runs led with it 3/3 |
| Rank by which of the three questions a finding answers | Same runs: the load-bearing finding moved from absent to first |
| Attribute what was already written down | Later runs separated documented design from findings; earlier runs presented comments as discoveries |
| Pin before reading, and treat drift as a failure | Found by accident: three of nine citations in the first document had drifted within a day, two onto unrelated code, and `check` exited 0 |

### Unmeasured

Six rules are in the skill on reasoning alone. Each is there because something
went wrong once, but none has been through a run that shows it prevents the
recurrence.

| Rule | Why it is there | What would measure it |
|---|---|---|
| Diff against the merge base, never the base branch | A run diffed against a stale local `master` and reported 452 deletions that did not exist, inventing a confident finding about unrelated code | A run on a subject whose base branch has moved since the fork |
| State the reconciliation result, even when empty | One run reported it, one said nothing, and silence was indistinguishable from not having run the command | Three runs; each should state the result either way |
| Open the commit behind a path that was undone | A run surfaced a reverted fix and filed it as merely "unrelated" among four benign renames | A subject containing a change a merge quietly reverted |
| Resolve an absence through to the consuming code | Five of six runs missed a dropped analytics event; the sixth found it unregistered and stopped before the consequence | A subject where an absence only matters two files away |
| Verify a caption that asserts an order or a cause | One run's caption claimed one line ran before another when the cited lines showed the reverse, and `check` passed it because the bytes were real | Runs graded on caption accuracy, not just citation resolution |
| Search for the other implementations of an idea | A reader had to ask "was there prior art?" after a real run, and the answer existed in the repository | A subject that reimplements something already present |

### Not measured at all

The skill's vocabulary was made repository-neutral after every run above. The
rules are structural rather than lexical, so the change should not matter — but
no run has read the current wording.

## Navigator behavioral exercises

The navigator sibling adds three behavioral exercises under the session workspace
`navigator-f4/`; they are not repository fixtures and were not run as part of this
slice. The prewritten grading key is kept beside them and must be read before any
exercise output:

1. **Exercise A — no-ticket architecture.** Start with a bounded map of the
   fixture's responsibilities and interactions. Identify one synchronous edge,
   one asynchronous edge, authoritative state, a derived value, and follow one
   cross-module behavior back to the map. Name an unknown boundary.
2. **Exercise B — PR reading.** Explain baseline behavior before the change, find a
   consumer and concrete failure consequence, distinguish observed code from
   documented intent and inference, and recognize an unfamiliar conventional
   pattern without calling it a defect.
3. **Exercise C — change preparation.** Search for and name prior art, identify
   affected contracts, choose the obvious focused test, keep scope narrow despite
   tempting cleanup, and stop for explicit edit approval even if asked to hurry.

`rubric.md` covers those clauses plus cross-cutting behavior: prose-first
explanation, an auditable source snapshot, honest unknowns, no invented
organizational rationale, meaningful pauses, user steering that changes depth or
direction, no source/runtime modifications, and artifacts only under
`navigator-f4/output/`. These are skill-behavior checks, not tool checks; until the
orchestrator runs and grades the exercises they remain unmeasured.

## READABILITY-001: the explanation-voice revision, measured

Both skills' writing instructions were revised together: a short orientation, the idea
before the terminology, connected paragraphs following one concrete behavior, and the
removal of the fixed ~1,500-word budget, the cite-don't-describe rule, the write-dry
mandate, the test-names-only shortcut, and the mandatory document inventory. This entry
records what was actually measured about that revision.

**Method.** Five cases, each run once against the frozen base skill bytes (ticket base
`3afb543`) and once against the candidate bytes — twelve executions in all, because an
independent instruction review found residual fixed-shape wording and the two explorer
cases were re-run against the corrected candidate (v2). Prompts, subjects, and the grading
key were frozen before any baseline ran; the key was written from source and withheld from
subjects; each subject agent saw only its assigned skill snapshot and its own output lease.
Subjects were the three direct-evidence fixtures above (A, B, C) and two pinned-SHA
repository cases at `f974ba10`, each HTML case rendering its own explanation through the
gated CLI.

**Independent factual grading.** Every applicable candidate clause passed — 89 of 89
across the final evidence set (navigator candidate v1, explorer candidate v2), with zero
fabricated claims in any output; every novel factual claim was checked against the fixture
bytes or the pinned SHA. The baselines passed 88 of 89, the one failure being audit-first
ordering in baseline E-PR — recorded for comparison, not as a blocker. Three runs read the
pinned `package.json` beyond the prompt-enumerated list. The baseline N-HTML prompt did not
explicitly authorize that read. The revised E-HTML and revised N-HTML dispatches explicitly
allowed reading the pinned file despite its omission from the frozen prompts. The later
E-HTML v2 dispatch also gave that permission, but the retained record must not be read as
proof that the v2 subject actually opened `package.json`. These authorization distinctions
supersede the shorthand in the earlier summary; the historical results and disclosures are
preserved.

**Machine checks.** `polytoken validate skill` exited 0 for both files; the focused smoke
(parse/cli/render, 94 tests) and the full aggregate (`npm run verify`: type-check, 152
tests, 25 browser tests) exited 0 on the revised tree.

**Not measured by any of that:** whether a human reader finds the outputs patient,
concrete, and clear at the right pace. Agent grading verified accuracy and safeguard
retention only; operator readability judgment was still pending when this entry was
written and does not belong to this file. Readability scores were not used as a
substitute. Paired runs are comparison evidence, not a controlled benchmark — samples
vary run to run. Evidence artifacts (manifests, frozen snapshots, run records, the grading
record, and two independent review reports) live in the session workspace under
`readability-001/`.

## How to measure a rule

Dispatch three or more agents with only the skill, a subject, and read-only
repository paths. Write the grading key from the code *before* reading any
output, and keep it outside the directory the agents write to — one run read the
key and produced an answer that had to be discarded.

Compare against the key, then verify each novel claim in the output. The tool
guarantees the code is real and says nothing about the prose beside it, so
checking captions is the part that cannot be skipped.

## READABILITY-001: prose-pass correction and evidence boundary

This entry corrects the historical record without replacing it. The retained `89/89`
figure is the result of independent factual grading of applicable skill clauses. It is
not a test count, a renderer-repair result, a readability measurement, or evidence that a
human accepted the voice. Likewise, the recorded test totals describe the tool and the
exercise runs; they do not establish that either narrative is clear or pleasant to read.

The earlier blanket authorization wording is superseded by the more precise record above.
The baseline N-HTML prompt did not explicitly authorize its `package.json` read. The
revised E-HTML and revised N-HTML dispatches explicitly allowed reading the pinned file,
even though the frozen prompts omitted it. The E-HTML v2 dispatch also gave that
permission, but permission alone is not evidence that the v2 subject actually read the
file. These distinctions correct the old summary without changing its historical results
or the disclosed output records.

The prose-pass copies under the session workspace are author-edited demonstrations. They
preserve the explorer subject's test-only scope and the navigator subject's parse/CLI/render
and test evidence at `f974ba10`, but they are not blind paired reruns and provide no new
independent behavioral evidence. A successful `check` establishes only that this Markdown
parsed and its source references resolved; it does not render HTML. A successful `render`
performs that acceptance and then generates HTML. Neither command establishes visual
correctness, good prose, renderer quality beyond the command's checks, or human acceptance.
An independent reviewer and the operator must still assess the copies directly.
