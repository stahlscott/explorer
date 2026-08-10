# ADR 0001: Stack

Status: accepted (2026-08-10)

Carried over from `~/code/explorer/docs/decisions/0001-v1-stack.md`, which was sound. The
schema and cap machinery it also specified is not carried over — see
`docs/superpowers/specs/2026-08-09-explorer2-design.md` for why.

## Context

Explorer2 needs a locally packaged CLI, deterministic single-file HTML, offline code
presentation and interaction, and unit plus browser verification with no application server.
Its one hard guarantee is that every line of code in the artifact was read from a repository at
a pinned SHA.

## Decision

Node 22+ and npm; strict TypeScript; esbuild for the bundle; Vitest for units; Playwright
Chromium for the artifact. Shiki for highlighting, with grammars and both themes pre-rendered
into the output — no CDN at render time and none at view time. `marked` for markdown, `yaml`
for front matter.

The artifact contains inline CSS and JavaScript only and requests nothing off disk.

## Notable consequences

- **Citations are resolved through `git show <sha>:<path>`, never the working tree.** The head
  ref in front matter is pinned to a SHA once per source, and every blob read uses that SHA.
  A dirty checkout cannot change what the artifact says. A test asserts this directly.
- **The bundle is 9.7 MB**, almost entirely Shiki grammars for the twelve bundled languages and
  two themes. Accepted: it buys a renderer that works with no network. Adding a language means
  editing `src/highlight.ts`, and anything not bundled falls back to plain text rather than
  failing.
- **`yaml` ships CJS that calls `require('process')`.** An ESM esbuild bundle cannot satisfy
  that on its own, so `scripts/build.mjs` injects a `createRequire` shim in the banner.
- **Byte-identity is asserted in the browser, not in Node.** Shiki emits both named and numeric
  HTML entities, and a Node-side regex decoder got that wrong and passed vacuously. The test
  now reads `textContent` from a real Chromium and compares against `git show`, so the
  assertion is about what a reader sees.
- **Cited code wraps rather than scrolls.** A horizontally scrolled line is a line the reader
  cannot see, which is the one thing a citation may never be, and it would be lost in print.
- **A project-level `.npmrc` points at the public registry**, because the global one points at
  StyleSeat's CodeArtifact. Nothing here is a work dependency.

## Alternatives

Unchanged from the prior ADR: a static-site generator adds page/build abstractions without
improving the producer-to-artifact path, and a non-TypeScript CLI would duplicate types across
the CLI and the browser payload for no gain at this size.
