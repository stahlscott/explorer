---
name: explorer
description: Use when a reader needs to understand a changeset, a stack of pull requests, or an unfamiliar subsystem — pre-PR review, onboarding a feature that spans repositories, or answering "how does this actually work" where the answer is spread across files.
---

# Explorer

## Overview

You write a document for one senior developer reading it cold. The tool guarantees
the code in it is real; you supply the judgement about what matters.

`explorer render` reads every code block out of git at a pinned SHA. You cannot type code
into the document — you emit a path and a line range, and the tool fetches it. That removes
fabrication from the problem, and leaves you the only job that was ever hard: deciding what
to say and in what order.

Three questions decide what matters. Rank what you find by which one it answers:

1. **Does the code do what it claims?** The claim is whatever is written down — a pull request
   body, a function name, a docstring, a comment that has outlived its code.
2. **Does it serve what depends on it?** The thing it was built for, or the callers that
   already exist and have to live with it.
3. **Is this how it should be done, given what already exists?** See step 6.

A defect that a linter, a type checker, or an automated reviewer would catch ranks below all
three. That layer is covered elsewhere now. What a reader cannot get anywhere else is the
judgement, and these three questions are what the judgement is about.

## When to use

- A stack of pull requests where something changes mid-stack and is invisible in review.
- A feature that spans repositories, so no single diff shows it.
- An unfamiliar subsystem, with no diff at all — "what persists, where, and what breaks".
- Any time the honest summary is longer than the reader's attention.

Not for: a single small diff a reader can just look at, or anything where you would end up
quoting the whole file.

## The procedure

Order matters. Steps 2 to 4 come before any depth-first reading, and steps 5 and 8 are
deliberately not adjacent.

1. **Pin the sources, then run `explorer pin`.** For each repo, find the ref that holds the
   work: `git log --oneline master..<branch>` maps branches to tickets, and
   `git worktree list` finds a stacked branch checked out elsewhere. Write the front matter,
   then pin it **before** you read anything. A branch name is not a pin — see Drift.

2. **Find the fork point, and diff against that — never against the base branch.**

   ```sh
   fork=$(git merge-base <base> <sha>)
   ```

   `git diff master..<sha>` is not the changeset. `master` has moved since the branch left
   it, and every commit it gained comes back inverted: master's additions read as this
   changeset's deletions. On a real subject that turned a 37-line addition into "37 added,
   452 deleted" and produced a confident, entirely false finding about unrelated code being
   removed. `base:` names a branch, and a branch is not a point — the same lesson as Drift,
   one commit earlier in the history.

3. **Account for every changed path.** `git diff --stat $fork..<sha>`. Group the paths by
   directory and give each group a reason for being in this changeset. Most sit in the
   feature's own directories and need no more than that.

   **A path outside them is a finding until you have opened it and decided otherwise.** A
   global stylesheet, a shared registry, a base class, a config file: something crossed out
   of the feature to reach it, and that is the change least likely to be reviewed and most
   likely to affect code nobody in the review is thinking about. Rank it before you know
   what it is, then open it — and let it be ordinary if it is ordinary. The instruction is to
   look, not to come back with something.

4. **Reconcile the commit list against the file list.** A commit can be in the branch while
   its content is not at the tip — a merge from the base takes the other side and the change
   is gone, with nothing anywhere saying so.

   ```sh
   comm -23 <(git log --name-only --pretty=format: $fork..<sha> | sed '/^$/d' | sort -u) \
            <(git diff --name-only $fork..<sha> | sort -u)
   ```

   Both sides must use the same `$fork..<sha>` range or the comparison is meaningless.

   Every path it prints was touched and then undone. Pair each one off against a rename or a
   renumber you can see in the diff. **A path with no such pair is a change that was lost** —
   open the commit, find out what it did, and report it. A fix that a merge quietly reverted
   is in the commit list and absent from the files-changed view, so neither review surface
   contradicts the other.

   **State the result in the document, including when it is empty.** "Three paths were
   touched and undone, all renames" is a sentence a reader can audit. Silence is
   indistinguishable from not having run it.

5. **Read the code, not the diffs.** Diffs show what moved; they hide what the moved code
   now does. Open the files.

6. **Find the other implementations of this idea.** Before describing anything as new, look
   for what already does the job. `git log -S<concept>` finds when the idea arrived and what
   it replaced; grep by the vocabulary the code uses, not by file names, since a second
   implementation rarely shares a naming convention with the first. (`-S` matches case
   exactly: `-SretryLimit` finds the commit, `-Sretrylimit` finds nothing and says nothing. A
   silent empty result is what a near-miss looks like, so search a string you know is there
   first and confirm the command finds it before trusting an empty one.)

   Three outcomes, each worth a sentence. **Nothing exists** — say so; the absence is context.
   **Something exists and was extended** — name it, so the reader has the lineage. **Something
   exists and was not used, or exists twice and both are live** — that is a finding, and
   usually the most consequential one available, because it is a decision rather than a defect.

   Search from the code's own vocabulary, not the pull request's, which you have not read yet.
   A reader who has to ask "was there prior art?" got a document that stopped one search short.

7. **Read the test names, not the test bodies.**
   `git show <sha>:<file> | grep -nE "^[[:space:]]*(it|test|def test)"`. The names are a
   written record of what the author believed mattered, and the gaps between them are usually
   the better finding. (`git grep -E` does not understand `\s`; use `[[:space:]]`.)
8. **Read the PR prose last.** It is claimed intent, not evidence. Reading it first tells you
   what to see. Reading it last lets you notice where it and the code disagree — which is
   often the most valuable sentence in the document.
9. **Hunt absences on purpose.** The strongest findings are things that are *not* there: no
   analytics call, no test for a path, no reader of a flag. Absence cannot be cited, so it
   must be searched for — and the search stated. See Claiming an absence.
10. **Draft against the budget**, in the shape below.
11. **`explorer check <doc.md>`** until it exits 0, then **check your own captions**, then
    **read the whole thing cold.** `check` proves the code is real and says nothing about the
    sentence beside it. A count you quote from a diff — lines added, lines removed, files
    touched — is a claim; re-run the command before you ship it. If you would not send it to
    a colleague, it is not done.
12. **Render it, and hand over the link.**
    `explorer render <doc.md> --open`. The artifact is the deliverable, not the
    markdown. End your reply with the `file://` URL the command printed, on its own line, so
    it is one click away. A reader who has to reconstruct the path will read your summary
    instead of the document — and the summary is the part with no citations in it.

## What the document is

A recipe, not a template. Produce these parts, in this order, and omit any that has nothing
in it.

1. **A lead that carries the findings.** First paragraph, before any structure. It names the
   two or three things a reader must know, in plain sentences. If your opening paragraph only
   says what the subject *is*, you have buried the lead.
2. **The shape.** Where the pieces live and how they relate. A list, if it is a list.
3. **What to read.** For a changeset: `core` files with a one-line reason each, and the rest
   named as a group. For a subsystem: the files *and the symbols inside them* that carry the
   behaviour. Write each path as `` `<source-id> <path>` `` — the tool resolves and links it.

   Putting a file in the support group is a claim that you opened it and it was ordinary.
   It is not a bin for the files you did not read.
4. **The design already on record.** A compressed account of the decisions the author
   documented — in comments, docstrings, the PR body, a shipped runbook — attributed to
   where they are written, and cited. This is real value: it is the abstract of the
   changeset, and it tells a reader what to hold in mind before they open a file.

   It is not a findings section. Say where each point comes from, so its weight is legible:
   *the docstring names the race it closes*, not a bare assertion in your own voice.
5. **The findings**: what the record does not state. Most important first, each one earning
   its place with a citation. A point already made in a comment belongs in part 4; the
   author's annotations map what they knew, and your value is what the map omits.
6. **What the tests cover, and what they do not.** Name the specific untested scenarios.
7. **What follows the existing pattern.** One sentence and one citation for the whole
   category. Anything conventional gets named and dismissed, not toured.
8. **What you could not determine.** Brief, specific, and honest about what would settle it.
   Not a parking space for a question one more file would answer.

**Order the whole document by importance, and let it taper** — journalism's inverted pyramid.
When you need to cut, cut from the bottom.

## Doctrine

- **Length is a budget.** Around 1,500 words, whether the subject is three files or sixty-five.
  A fixed budget is what forces ranking; you cannot pay per-file attention out of it.
- **Cite the code instead of describing it.** "This calculates the order count" tells a reader
  who can already read code nothing. Show the four lines and spend your words on what is
  surprising about them.
- **Rank by surprise, not by size.** Two lines that change a shared contract outrank eight
  hundred lines of scaffolding.
- **A decision outranks a defect.** The most consequential thing is usually a choice someone
  made — a second implementation of something that already existed, a shared contract changed
  in passing — not a bug. Bugs have owners and tooling. Choices only have readers.
- **Write dry.** Short sentences, active voice, simple tenses, one idea per sentence. Connective
  flourishes — "together they are a trap", "everything below is about the seams" — carry no
  information and read as filler. State the finding and stop.
- **Test code is support; test coverage is core.** What the suites assert is a finding. What
  they omit is usually a better one.
- **State the answer, not the choice.** If one of two systems is deprecated, the section says
  which to use and what the split costs. Do not stage a decision the reader does not have.
- **Captions carry the contrast.** A citation shows what the code is; the caption says what it
  was, or what it is not. "Previously `borderWidth: 1`, for every variant at every size."
- **A caption is the one thing the tool cannot check.** `check` proves the bytes; the sentence
  beside them is yours. So a caption that asserts an order, a cause, or a mechanism gets read
  back against the lines it sits beside, every time. "Runs before the flag check" is a claim
  about two line numbers, and getting it backwards spends a reader's trust on nothing.
- **Attribute what was already written down.** Compressing the author's own comments is
  useful work — it is the abstract of the changeset. Passing it off as discovered is not.
  Findings are what the annotations omit.

## Drift

`head: feature/statements` names a branch, and a stacked branch gets rebased. Resolve it at render time
and the same line range shows different code beside unchanged prose — silently, because the
range still resolves. This is the guarantee failing in the one way that does not look like a
failure.

So a document records `sha:` per source, and a branch that has moved off it is a build
failure. `explorer pin` writes those SHAs. Pin first, before reading, so the tree cannot
change underneath the analysis.

When `check` reports `moved-head`, **re-read the citations before repinning.** Pinning is
mechanical; it records where the branch is, and does nothing to the sentences. Repinning a
drifted document just makes it wrong quietly instead of loudly. For a document that reports
on a tree that is no longer any branch's tip — most finished documents — set `head:` to the
SHA itself and leave a comment naming the branch it was.

This was found by accident: three of nine citations in the first document had drifted within a
day, two of them onto completely unrelated code, and `check` exited 0.

## Claiming an absence

`:::cite` makes fabricated code inexpressible. It does nothing for "there is no X" — the
sentence most likely to be wrong, because nothing checks it.

Before writing one: run the search, over the whole relevant surface, and say so in the
document. "The feature contains no `analytics.track` call. I checked every non-test file the
three PRs add." A reader can audit that sentence. "The feature has no analytics" is a rumour.

Two absence claims in the first two documents were wrong on the first attempt, and both were
caught by searching rather than re-reading.

**Then resolve what the absence costs.** An absence is half a finding: the other half is the
code that consumes what is missing. "The name is not in the registry" is where the search ends
and the finding starts — open whatever reads that registry, find the branch that decides what
happens to a name it does not know, and report the consequence. One more file usually turns
*could not determine* into a finding, and a question that one file would settle does not belong in
part 8.

## Red flags

| You are about to… | Instead |
|---|---|
| Open with what the subject is | Open with what the reader must know |
| Describe a function in prose | Cite it and say what is surprising |
| Give every file a paragraph | Rank: core, then the rest as a group |
| Write "there is no…" | Run the search, then state the search |
| Quote the PR to explain intent | Reconstruct intent from code; note where they differ |
| Tour a conventional pattern | One sentence, one citation, move on |
| Add a section because it feels missing | Cut from the bottom; the budget is fixed |
| Repin a drifted document to make `check` pass | Re-read the citations first; `check` was right |
| Call a file support without opening it | Open it; outside the feature's directories it is a finding until it isn't |
| Diff against `master` because `base:` says so | Diff against the merge-base; master has moved since the fork |
| Report a line count you read once and did not re-run | It is a claim like any other; verify it before shipping it |
| Come back from an out-of-feature file with a finding it will not support | Ordinary is a valid answer. The step says look, not deliver |
| Treat the diff as the list of what changed | Reconcile it against the commit list; a merge can undo a commit |
| Present a comment's content as your own finding | Attribute it, and file it on the record |
| Write a caption asserting an order or a cause | Read it back against the lines it sits beside |
| Stop at "it is not in the registry" | Open the consumer; report what the absence costs |
| Call something new without looking for the old one | Search the repo's own vocabulary; existing-and-unused is the finding |
| Rank a lint-level defect above a design choice | That layer is covered; rank by the three questions |
| Leave the reader to reconstruct the artifact's path | End with the `file://` URL on its own line |

## Format and tooling

`explorer pin <doc.md>` records each source's current SHA in the front matter.
`explorer check <doc.md>` resolves citations and file references; exit 0 means every claim
about a path is true. `explorer render <doc.md>` writes the artifact beside the document and
refuses if anything fails; it prints an absolute `file://` URL, `-o` overrides the path, and
`--open` opens it. The reading surface is not yours to pick: every artifact ships all of them
and the reader cycles with the button.

Syntax, front matter, and the failure messages are in
[references/format.md](references/format.md).
