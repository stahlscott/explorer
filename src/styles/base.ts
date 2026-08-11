/**
 * Layout and code mechanics, shared by every skin. Skins set the tokens and the
 * citation treatment; nothing here picks a colour.
 *
 * Two measures, placed with grid. Prose sits in the centre track; code and
 * tables span all three. Grid placement is used rather than auto margins
 * because an earlier version set the margins in a rule that a later `p` rule
 * overrode at equal specificity, which left prose left-aligned and looking
 * hard-wrapped.
 *
 * No backticks below this line: the CSS is a template literal, and a backtick in
 * a comment ends it. That has broken this file three times.
 */
export const BASE_STYLE = `
/* The nav's own width plus the gap either side of it. Layout reserves exactly
   this much, so the nav's size is stated once and both rules read it. */
:root { --nav-column: 16rem; }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-prose);
  font-size: var(--size-prose);
  line-height: var(--line-prose, 1.62);
  text-rendering: optimizeLegibility;
}
main {
  max-width: var(--measure-code);
  margin: 0 auto;
  padding: 3.5rem 1.25rem 7rem;
  display: grid;
  grid-template-columns:
    minmax(0, 1fr)
    minmax(0, var(--measure-text))
    minmax(0, 1fr);
  align-content: start;
}
main > * { grid-column: 2; min-width: 0; }
main > figure.cite,
main > .sketch,
main > table {
  grid-column: 1 / -1;
}

h1, h2, h3 { font-family: var(--font-head); }
h1 {
  font-size: var(--size-h1);
  line-height: 1.15;
  letter-spacing: -.02em;
  margin: 0 0 .6rem;
  font-weight: var(--weight-head);
}
h2 {
  font-size: var(--size-h2);
  line-height: 1.2;
  letter-spacing: -.015em;
  margin: 3.5rem 0 1rem;
  font-weight: var(--weight-head);
}
h3 { font-size: var(--size-h3); margin: 2.25rem 0 .6rem; font-weight: var(--weight-head); }
p { margin: 0 0 1.15rem; }
a { color: var(--accent); text-underline-offset: 2px; }
strong { font-weight: 650; }
ul, ol { padding-left: 1.3rem; margin: 0 0 1.15rem; }
li { margin-bottom: .45rem; }
hr { border: 0; border-top: 1px solid var(--rule); margin: 2.5rem 0; }

header { padding-bottom: 1.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--rule); }
.question {
  color: var(--ink-soft);
  font-size: 1.02em;
  margin: 0 0 1.1rem;
}
ul.pins {
  list-style: none;
  margin: 0;
  padding: 0;
  font-family: var(--font-mono);
  font-size: .74rem;
  color: var(--ink-soft);
  display: grid;
  gap: .3rem;
}
ul.pins li { display: flex; gap: .55rem; align-items: baseline; flex-wrap: wrap; margin: 0; }
.pin-id { font-weight: 700; color: var(--ink); }
.pin-repo { color: var(--ink-soft); }
.pin-sha { font-size: .68rem; color: var(--ink-faint); background: none; padding: 0; }
.pin-base { color: var(--ink-faint); }
.pin-pr { font-weight: 600; text-decoration: none; }
.pin-pr:hover { text-decoration: underline; }

blockquote {
  margin: 1.2rem 0;
  padding: .1rem 0 .1rem 1.1rem;
  border-left: 2px solid var(--rule);
  color: var(--ink-soft);
}
table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  margin: 1.2rem 0 1.8rem;
  font-family: var(--font-ui);
  font-size: .82rem;
  line-height: 1.5;
}
th, td {
  border-bottom: 1px solid var(--rule);
  padding: .45rem .7rem .45rem 0;
  text-align: left;
  vertical-align: top;
}
th {
  font-weight: 600;
  color: var(--ink-faint);
  font-size: .7rem;
  text-transform: uppercase;
  letter-spacing: .06em;
  border-bottom-color: var(--ink-faint);
}
td:first-child { width: 46%; }
td code { overflow-wrap: anywhere; background: none; padding: 0; font-size: .95em; }

/* A file the tool resolved, so the link target came from the repository rather
   than from whoever wrote the sentence. */
a.file-ref { text-decoration: none; border-bottom: 1px solid var(--rule); }
a.file-ref:hover { border-bottom-color: var(--accent); }
a.file-ref code, span.file-ref code { color: inherit; }

/* No side padding: a chip's padding reads as a word space, which puts a phantom
   gap before the comma in a phrase like "packages/ui, which". */
code {
  font-family: var(--font-mono);
  font-size: .86em;
  background: var(--wash);
  padding: .1em 0;
  border-radius: 2px;
  box-decoration-break: clone;
}

/* --- code mechanics, identical in every skin ----------------------------- */
pre.shiki { margin: 0; background: transparent !important; }
pre.shiki code { background: none; padding: 0; font-size: inherit; white-space: normal; }
.cite-code, .sketch { overflow: hidden; }
.cite pre.shiki, .sketch pre.shiki {
  font-size: var(--size-code);
  line-height: 1.6;
  font-family: var(--font-mono);
}

/* Shiki separates line spans with real newlines. Under white-space:pre those
   newlines keep their own line boxes, so a hidden context line would still
   occupy height. Collapse whitespace on the container, restore it per line.
   Wrap rather than scroll: a scrolled-away line is a line the reader cannot
   see, which is the one thing a citation may never be, and it would be lost
   in print. The left pad gives wrapped runs a hanging indent. */
.line {
  display: block;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  padding-left: 3.4rem;
  position: relative;
  min-height: 1.6em;
}
.line::before {
  content: attr(data-line);
  position: absolute;
  left: 0;
  width: 2.6rem;
  text-align: right;
  color: var(--ink-faint);
  opacity: .6;
  user-select: none;
  font-variant-numeric: tabular-nums;
}
figure.cite { margin: 1.7rem 0; }
figure.cite:not([data-expanded]) .line.ctx { display: none; }
figure.cite[data-expanded] .line.ctx { opacity: .45; }

/* --- affordances --------------------------------------------------------- */
.cite-head { font-family: var(--font-mono); font-size: .72rem; }
.cite-where { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.cite-where b { color: var(--ink); font-weight: 700; }
.cite-dir { color: var(--ink-faint); }
.cite-tail { white-space: nowrap; }
.cite-file { color: var(--ink-soft); }
.cite-lines { color: var(--ink-faint); white-space: nowrap; margin-left: .45rem; }
.cite-acts { flex: 0 0 auto; display: flex; gap: .1rem; align-self: flex-start; }
button.cite-more, button.ask, a.cite-link {
  font: inherit;
  font-family: var(--font-mono);
  font-size: .68rem;
  color: var(--ink-faint);
  background: none;
  border: 0;
  padding: .1rem .25rem;
  cursor: pointer;
  text-decoration: none;
  border-radius: 3px;
  white-space: nowrap;
}
button.cite-more:hover, button.ask:hover, a.cite-link:hover {
  color: var(--ink);
  background: var(--wash);
}
h1 .ask, h2 .ask, h3 .ask {
  margin-left: .5rem;
  vertical-align: middle;
  opacity: 0;
  transition: opacity .12s;
}
h1:hover .ask, h2:hover .ask, h3:hover .ask, .ask:focus-visible { opacity: 1; }

/* --- author-written code, deliberately unlike a citation ----------------- */
.sketch {
  margin: 1.6rem auto;
  border: 1px dashed var(--ink-faint);
  border-radius: 4px;
  background: var(--wash);
  position: relative;
}
.sketch-tag {
  position: absolute;
  top: 0;
  right: 0;
  font-family: var(--font-mono);
  font-size: .6rem;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--ink-faint);
  padding: .25rem .55rem;
}
.sketch pre.shiki { padding: .8rem 0; }
.sketch .line { padding-left: 1rem; }
.sketch .line::before { content: none; }

.toast {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ink);
  color: var(--paper);
  font-family: var(--font-ui);
  font-size: .78rem;
  padding: .45rem .9rem;
  border-radius: 999px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, .18);
}


/* --- section nav --------------------------------------------------------- */
.toc {
  position: fixed;
  top: 3.5rem;
  left: 1.5rem;
  width: 13rem;
  max-height: calc(100vh - 7rem);
  overflow-y: auto;
  font-family: var(--font-ui);
  font-size: .78rem;
  line-height: 1.4;
  display: none;
}
.toc ol { list-style: none; margin: 0; padding: 0; }
.toc li { margin: 0 0 .35rem; }
.toc a {
  color: var(--ink-faint);
  text-decoration: none;
  display: block;
  padding: .1rem 0 .1rem .6rem;
  border-left: 2px solid transparent;
}
.toc a:hover { color: var(--ink-soft); }
.toc li.toc-3 a { padding-left: 1.5rem; font-size: .74rem; }
.toc a[aria-current="true"] {
  color: var(--ink);
  border-left-color: var(--accent);
  font-weight: 600;
}

/* Only when there is room beside the reading column; below that the reader
   scrolls, which is what the nav was for.

   The nav is fixed and main is centred, so nothing makes them agree about
   space: a centred column wide enough to hold code puts its left edge inside
   the nav, and full-bleed figures render underneath the links. Reserving the
   nav's column as padding and widening main to match keeps the reading column
   the same size and centres it in what is left, which no viewport width can
   undo. */
@media (min-width: 78rem) {
  .toc { display: block; }
  main {
    max-width: calc(var(--measure-code) + var(--nav-column));
    padding-left: calc(1.25rem + var(--nav-column));
  }
}

.theme-toggle {
  position: fixed;
  top: 1rem;
  right: 1rem;
  font-family: var(--font-ui);
  font-size: .72rem;
  color: var(--ink-soft);
  background: var(--card);
  border: 1px solid var(--rule);
  border-radius: 999px;
  padding: .3rem .7rem;
  cursor: pointer;
  z-index: 5;
}
.theme-toggle:hover { color: var(--ink); }
@media print { .toc, .theme-toggle { display: none !important; } }

@media (max-width: 40rem) {
  main { padding: 2rem 1rem 4rem; }
  .line { padding-left: 2.8rem; }
  .line::before { width: 2.1rem; }
  td:first-child { width: 42%; }
}

@media print {
  html { font-size: 10.5pt; }
  body { background: #fff; color: #000; }
  main { max-width: none; padding: 0; }
  button.cite-more, button.ask, a.cite-link, .toast { display: none !important; }
  figure.cite, .sketch, table { break-inside: avoid; }
  h2, h3 { break-after: avoid; }
  .shiki, .shiki span { color: var(--shiki-light) !important; }
}
`;

/** Shiki writes both variables on every token; the media query picks one. */
export const SHIKI_THEME_SWITCH = `
.shiki span { color: var(--shiki-light); }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .shiki span { color: var(--shiki-dark); }
}
:root[data-theme="dark"] .shiki span { color: var(--shiki-dark); }
:root[data-theme="light"] .shiki span { color: var(--shiki-light); }
`;
