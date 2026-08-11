# Format reference

A document is markdown with front matter and one directive. Everything else is ordinary
markdown: headings, bullets, tables, emphasis, links, blockquotes.

## Front matter

```yaml
---
title: Statements — how one period becomes one row
question: >              # optional; for exploration documents with no diff
  When the statements hook returns null, what does that actually mean?
sources:
  - id: api              # required; how citations name this repo
    repo: acme/platform         # optional; enables GitHub links
    path: ~/src/platform        # required; a local clone
    base: main                  # optional; documentation only, never resolved
    head: feature/statements    # required; branch, tag, or SHA
    sha: 6d6d67216b2b...        # written by `explorer pin`; drift is a failure
    pr: 4120                    # optional; `prs: [8801, 8802]` for several
---
```

`head` may be a branch, tag, or SHA. Every blob is read at `sha`, so a dirty checkout cannot
change what the artifact says — and neither can a rebase. If `head` no longer points at `sha`,
`check` fails with `moved-head` rather than quietly showing you a different tree. Run
`explorer pin` to record or update it, and re-read the citations when it moves. Unknown keys
pass through untouched. Values may carry trailing `#` comments.

## Citing code

```
:::cite web src/features/statements/useStatement.ts:14-23
Null before the first response, and null again when the period has no statement.
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
| `web src/features/statements/useStatement.ts` | The fetch, and the null that means two things. |
```

The path may be abbreviated — the fragment must match exactly one file. An explicit reference
that matches none or several **fails the build**, so a file list is checked rather than
asserted.

In a single-source document a bare path containing a `/` is also resolved, but it never fails:
prose is not a claim about a path. That is what keeps a passing mention like
`` `statements/generate` `` from breaking a build.

## Fenced blocks

Ordinary fenced code renders visibly differently from a citation and is labelled *not from the
repo*. Use it for illustration only. A `:::cite` inside a fenced block is documentation, not a
citation, and is left alone.

## Failures

`check` and `render` exit 1 and print one line per failure. Each is actionable on its own:

| Code | Message |
|---|---|
| `range-past-eof` | `web src/x.ts has 41 lines, cited 55-60` |
| `missing-file` | `web src/gone.ts is not present at feature/statements (3b76f0a194)` |
| `unknown-source` | `unknown source 'nope' in src/a.ts; declared sources are web, api` |
| `ref-not-found` | `web has no ref 'feature/statements' locally; fetch it or pin a different head` |
| `repo-not-found` | `web /path is not a git repository` |
| `missing-reference` | `web nope/gone.ts matches no file at feature/statements` |
| `ambiguous-reference` | `web types.ts matches 2 files at feature/statements; name more of the path` |
| `moved-head` | `web was pinned to 3b76f0a194 but feature/statements is now 78df615f91; re-read the citations, then repin` |

Exit 2 means wrong usage, not a bad document.

## The artifact

One self-contained HTML file. No network at render time and none at view time: highlighting is
pre-rendered, styles and script are inline. It opens from `file://`, prints, and survives
being emailed. `render` prints the artifact's absolute `file://` URL so a terminal can open it,
and `--open` opens it directly.

Every reading surface ships in the file — auto, light, dark, newsprint, terminal, geocities —
and the button cycles them. The reader chooses; whoever rendered it does not.

Each citation carries `github` (a permalink at the pinned SHA), `editor` (only when some
checkout is actually at that SHA, so the link opens the bytes the document shows), and `ask`,
which copies a prompt naming the repo, SHA, path and lines for pasting back into a harness.
Sections carry `ask` too.
