/**
 * Inlined into every artifact. No external URLs, no webfonts, no CDN — the
 * document has to open from file:// with the network denied and lose nothing.
 */
export const PAGE_STYLE = `
:root {
  --ink: #1a1a1a;
  --ink-soft: #5b5b5b;
  --ink-faint: #8a8a8a;
  --rule: #e2e2e2;
  --paper: #fffdfb;
  --card: #ffffff;
  --accent: #2c5aa0;
  --sketch: #f4f1ec;
  font-size: 17px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ink: #e8e6e3;
    --ink-soft: #a8a5a1;
    --ink-faint: #77746f;
    --rule: #33312e;
    --paper: #171614;
    --card: #1e1d1b;
    --accent: #8ab4f8;
    --sketch: #232220;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: ui-serif, Georgia, "Times New Roman", serif;
  line-height: 1.6;
}
main {
  max-width: 42rem;
  margin: 0 auto;
  padding: 3rem 1.25rem 6rem;
}
header { border-bottom: 1px solid var(--rule); padding-bottom: 1.25rem; margin-bottom: 2rem; }
h1 { font-size: 1.9rem; line-height: 1.25; margin: 0 0 .5rem; letter-spacing: -.01em; }
h2 {
  font-size: 1.3rem;
  margin: 2.75rem 0 .75rem;
  line-height: 1.3;
  letter-spacing: -.005em;
}
h3 { font-size: 1.08rem; margin: 2rem 0 .5rem; }
p { margin: 0 0 1rem; }
a { color: var(--accent); }
strong { font-weight: 650; }
.question {
  color: var(--ink-soft);
  font-style: italic;
  margin: 0 0 1rem;
}
ul.pins { list-style: none; margin: 0; padding: 0; font-size: .8rem; color: var(--ink-soft); }
ul.pins li { display: flex; gap: .5rem; align-items: baseline; flex-wrap: wrap; }
.pin-id { font-weight: 700; color: var(--ink); }
.pin-sha { font-size: .72rem; color: var(--ink-faint); word-break: break-all; }
.pin-base { color: var(--ink-faint); }

/* --- prose --------------------------------------------------------------- */
blockquote {
  margin: 1rem 0;
  padding: 0 0 0 1rem;
  border-left: 2px solid var(--rule);
  color: var(--ink-soft);
}
table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  margin: 1rem 0 1.5rem;
  font-size: .85rem;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
th, td { border-bottom: 1px solid var(--rule); padding: .4rem .6rem; text-align: left; vertical-align: top; }
/* File paths are the common first column and they do not contain spaces. */
td code { overflow-wrap: anywhere; background: none; padding: 0; }
th { font-weight: 650; color: var(--ink-soft); font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; }
/* No horizontal padding: a chip's side padding reads as a word space, putting
   a phantom gap before the comma in a phrase like "packages/ui, which". */
code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  font-size: .84em;
  background: var(--sketch);
  padding: .08em 0;
  border-radius: 2px;
  box-decoration-break: clone;
}
li { margin-bottom: .3rem; }

/* --- citations ----------------------------------------------------------- */
figure.cite {
  margin: 1.5rem 0;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--card);
  overflow: hidden;
}
.cite-head {
  display: flex;
  align-items: baseline;
  gap: .5rem;
  padding: .4rem .7rem;
  border-bottom: 1px solid var(--rule);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: .72rem;
  color: var(--ink-soft);
}
/* Never truncate: for a citation the path is the provenance, and an ellipsis
   would hide which file the claim is about. Long paths wrap instead. */
.cite-where { overflow-wrap: anywhere; min-width: 0; }
.cite-where b { color: var(--ink); font-weight: 700; }
.cite-lines { color: var(--ink-faint); margin-right: auto; white-space: nowrap; }
figure.cite figcaption {
  padding: .5rem .85rem .6rem;
  border-top: 1px solid var(--rule);
  font-size: .88rem;
  color: var(--ink-soft);
}
.cite-code { overflow-x: auto; }
.cite pre.shiki {
  margin: 0;
  padding: .6rem 0;
  font-size: .78rem;
  line-height: 1.55;
  background: transparent !important;
}
/* Shiki separates line spans with real newlines. Under white-space:pre those
   newlines keep their own line boxes, so a hidden context line would still
   occupy height. Collapse whitespace on the container, restore it per line. */
.cite pre.shiki code {
  background: none;
  padding: 0;
  font-size: inherit;
  white-space: normal;
}
/* Wrap rather than scroll. A horizontally scrolled line is a line the reader
   cannot see, which is the one thing a citation may never be, and it would be
   lost entirely in print. The left pad gives wrapped runs a hanging indent. */
.cite .line {
  display: block;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  padding-left: 3.6rem;
  position: relative;
  min-height: 1.55em;
}
.cite .line::before {
  content: attr(data-line);
  position: absolute;
  left: 0;
  width: 2.9rem;
  text-align: right;
  color: var(--ink-faint);
  opacity: .55;
  user-select: none;
}
figure.cite:not([data-expanded]) .line.ctx { display: none; }
figure.cite[data-expanded] .line.ctx { opacity: .55; }

button.cite-more, button.ask {
  font: inherit;
  font-size: .68rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--ink-faint);
  background: none;
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: .1rem .4rem;
  cursor: pointer;
}
button.cite-more:hover, button.ask:hover { color: var(--ink); border-color: var(--ink-faint); }
h1 .ask, h2 .ask, h3 .ask {
  margin-left: .6rem;
  vertical-align: middle;
  opacity: 0;
  transition: opacity .12s;
}
h1:hover .ask, h2:hover .ask, h3:hover .ask, .ask:focus-visible { opacity: 1; }

/* --- author-written code, deliberately unlike a citation ------------------ */
.sketch {
  margin: 1.5rem 0;
  border: 1px dashed var(--ink-faint);
  border-radius: 6px;
  background: var(--sketch);
  position: relative;
  overflow-x: auto;
}
.sketch-tag {
  position: absolute;
  top: 0;
  right: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: .62rem;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: var(--ink-faint);
  padding: .2rem .5rem;
}
.sketch pre.shiki {
  margin: 0;
  padding: .7rem .85rem;
  font-size: .78rem;
  line-height: 1.55;
  background: transparent !important;
}
.sketch pre.shiki code { background: none; padding: 0; font-size: inherit; }

.toast {
  position: fixed;
  bottom: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ink);
  color: var(--paper);
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: .78rem;
  padding: .4rem .8rem;
  border-radius: 999px;
}

@media (prefers-color-scheme: dark) {
  .shiki, .shiki span { color: var(--shiki-dark) !important; }
}
@media (prefers-color-scheme: light) {
  .shiki, .shiki span { color: var(--shiki-light) !important; }
}

@media print {
  :root { font-size: 11pt; }
  body { background: #fff; }
  button.cite-more, button.ask, .toast { display: none !important; }
  figure.cite, .sketch { break-inside: avoid; }
  .shiki, .shiki span { color: var(--shiki-light) !important; }
}
`;

export const PAGE_SCRIPT = `
(function () {
  var toast = document.querySelector('.toast');
  var toastTimer;

  function flash(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 1600);
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // file:// without an async clipboard still has the synchronous path.
    var scratch = document.createElement('textarea');
    scratch.value = text;
    scratch.setAttribute('readonly', '');
    scratch.style.position = 'fixed';
    scratch.style.opacity = '0';
    document.body.appendChild(scratch);
    scratch.select();
    try { document.execCommand('copy'); } finally { document.body.removeChild(scratch); }
    return Promise.resolve();
  }

  document.addEventListener('click', function (event) {
    var ask = event.target.closest('.ask');
    if (ask) {
      copy(ask.getAttribute('data-ask') || '')
        .then(function () { flash('prompt copied'); })
        .catch(function () { flash('could not copy'); });
      return;
    }

    var more = event.target.closest('.cite-more');
    if (!more) return;

    var figure = more.closest('figure.cite');
    // Context opens inside the figure, above the cited lines. Anchor on the
    // first cited line rather than the figure: the figure's top does not move,
    // but the code the reader is actually looking at does.
    var anchor = figure.querySelector('.line:not(.ctx)') || figure;
    var before = anchor.getBoundingClientRect().top;
    var expanded = figure.hasAttribute('data-expanded');
    if (expanded) figure.removeAttribute('data-expanded');
    else figure.setAttribute('data-expanded', '');
    more.setAttribute('aria-expanded', String(!expanded));
    more.textContent = expanded ? 'context' : 'less';
    window.scrollBy(0, anchor.getBoundingClientRect().top - before);
  });
})();
`;
