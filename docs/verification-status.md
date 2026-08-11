# Verification status

What has actually been measured, and what has not. Read this before trusting any
rule in the skill, and update it when a rule gets tested.

The corpus those measurements ran against is deliberately not in this repository
— it analysed a private codebase — so this file is the only surviving record of
what was established. Losing it means starting the measurement over.

Last updated: 2026-08-11.

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

## How to measure a rule

Dispatch three or more agents with only the skill, a subject, and read-only
repository paths. Write the grading key from the code *before* reading any
output, and keep it outside the directory the agents write to — one run read the
key and produced an answer that had to be discarded.

Compare against the key, then verify each novel claim in the output. The tool
guarantees the code is real and says nothing about the prose beside it, so
checking captions is the part that cannot be skipped.
