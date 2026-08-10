# Format reference

A document is markdown with front matter and one directive. Everything else is ordinary
markdown: headings, bullets, tables, emphasis, links, blockquotes.

## Front matter

```yaml
---
title: Feature feedback — DEV-193 / 218 / 173 / 219
question: >              # optional; for exploration documents with no diff
  When a feature stores a per-user flag, what actually persists?
sources:
  - id: api              # required; how citations name this repo
    repo: styleseat/styleseat   # optional; enables GitHub links
    path: ~/work/styleseat      # required; a local clone
    base: master                # optional; documentation only, never resolved
    head: dev-193               # required; branch, tag, or SHA
    sha: 6d6d67216b2b...        # written by `explorer pin`; drift is a failure
    pr: 10095                   # optional; `prs: [12800, 12805]` for several
---
```

`head` may be a branch, tag, or SHA. Every blob is read at `sha`, so a dirty checkout cannot
change what the artifact says — and neither can a rebase. If `head` no longer points at `sha`,
`check` fails with `moved-head` rather than quietly showing you a different tree. Run
`explorer pin` to record or update it, and re-read the citations when it moves. Unknown keys
pass through untouched. Values may carry trailing `#` comments.

## Citing code

```
:::cite web src/feedback/eligibility.ts:34-41
The frequency check reads localStorage, not the API.
:::
```

- The source id is omitted when the document declares exactly one source.
- `:::cite web src/a.ts:89` cites a single line.
- The caption is optional, one line, and rendered as inline markdown.
- The reader gets twelve lines of context either side, collapsed, expandable in place.

A citation may not be forged: you emit a path and a range, and the renderer fetches the bytes.
It also may not be *stretched* — if the range is wrong, `check` says so rather than rendering
something plausible.

## Naming a file in prose

A code span written as `` `<source-id> <path>` `` is looked up in the tree at the pinned SHA
and linked by the tool:

```markdown
| `web modules/provider/FeatureFeedback/types.ts` | The persisted state shape. |
```

The path may be abbreviated — the fragment must match exactly one file. An explicit reference
that matches none or several **fails the build**, so a file list is checked rather than
asserted.

In a single-source document a bare path containing a `/` is also resolved, but it never fails:
prose is not a claim about a path. That is what keeps `` `ProviderGoals.model` `` from
breaking a build.

## Fenced blocks

Ordinary fenced code renders visibly differently from a citation and is labelled *not from the
repo*. Use it for illustration only. A `:::cite` inside a fenced block is documentation, not a
citation, and is left alone.

## Failures

`check` and `render` exit 1 and print one line per failure. Each is actionable on its own:

| Code | Message |
|---|---|
| `range-past-eof` | `web src/x.ts has 41 lines, cited 55-60` |
| `missing-file` | `web src/gone.ts is not present at dev-219 (3b76f0a194)` |
| `unknown-source` | `unknown source 'nope' in src/a.ts; declared sources are web, api` |
| `ref-not-found` | `web has no ref 'dev-219' locally; fetch it or pin a different head` |
| `repo-not-found` | `web /path is not a git repository` |
| `missing-reference` | `web nope/gone.ts matches no file at dev-219` |
| `ambiguous-reference` | `web types.ts matches 2 files at dev-219; name more of the path` |
| `moved-head` | `web was pinned to 3b76f0a194 but dev-219 is now 78df615f91; re-read the citations, then repin` |

Exit 2 means wrong usage, not a bad document.

## The artifact

One self-contained HTML file. No network at render time and none at view time: highlighting is
pre-rendered, styles and script are inline. It opens from `file://`, prints, and survives
being emailed.

Each citation carries `github` (a permalink at the pinned SHA), `editor` (only when some
checkout is actually at that SHA, so the link opens the bytes the document shows), and `ask`,
which copies a prompt naming the repo, SHA, path and lines for pasting back into a harness.
Sections carry `ask` too.
