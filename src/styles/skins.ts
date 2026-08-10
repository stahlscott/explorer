/**
 * Three treatments of the same document, kept side by side only long enough to
 * choose one. The losers get deleted; a renderer with a theme switcher is
 * machinery nobody asked for.
 *
 * They differ where the first read said it hurt: how light the page is, how
 * much hierarchy the headings carry, and how heavy a citation looks when there
 * are nine of them.
 */

const SANS = 'ui-sans-serif, -apple-system, "Segoe UI", Inter, system-ui, sans-serif';
const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, ui-serif, serif';
const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';

/**
 * Paper. Warm near-white, serif prose, and citations with no box at all — a
 * rule down the left and a caption line above. Nine of them should read as nine
 * quotations, not nine widgets.
 */
const PAPER = `
:root {
  --paper: #fcfbf7;
  --card: #fcfbf7;
  --wash: #f1efe8;
  --ink: #1c1b19;
  --ink-soft: #55524c;
  --ink-faint: #928d84;
  --rule: #e0dcd1;
  --accent: #8c4a2f;
  --font-prose: ${SERIF};
  --font-head: ${SERIF};
  --font-ui: ${SANS};
  --font-mono: ${MONO};
  --size-prose: 1.09rem;
  --size-code: .84rem;
  --size-h1: 2.3rem;
  --size-h2: 1.62rem;
  --size-h3: 1.15rem;
  --weight-head: 600;
  --measure-text: 34rem;
  --measure-wide: 47rem;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #14130f;
    --card: #14130f;
    --wash: #211f1a;
    --ink: #ece8df;
    --ink-soft: #aaa49a;
    --ink-faint: #736d63;
    --rule: #2e2b25;
    --accent: #d99e7d;
  }
}
figure.cite {
  margin: 1.9rem auto;
  border-left: 2px solid var(--rule);
  padding-left: 1.1rem;
}
.cite-head {
  display: flex;
  align-items: baseline;
  gap: .5rem;
  color: var(--ink-faint);
  padding: 0 0 .4rem;
}
.cite-lines { margin-right: auto; }
.cite pre.shiki { padding: 0; }
figure.cite figcaption {
  padding: .55rem 0 0;
  font-size: .92rem;
  color: var(--ink-soft);
  max-width: var(--measure-text);
}
`;

/**
 * Panel. White page, sans-serif everything, citations as a tinted panel with a
 * header band. The closest to a tool, and the most legible at small sizes.
 */
const PANEL = `
:root {
  --paper: #ffffff;
  --card: #f8f9fb;
  --wash: #eef1f5;
  --ink: #16181d;
  --ink-soft: #4c525d;
  --ink-faint: #8b929e;
  --rule: #e3e7ee;
  --accent: #1f5fd0;
  --font-prose: ${SANS};
  --font-head: ${SANS};
  --font-ui: ${SANS};
  --font-mono: ${MONO};
  --size-prose: 1.02rem;
  --size-code: .82rem;
  --size-h1: 1.95rem;
  --size-h2: 1.4rem;
  --size-h3: 1.08rem;
  --weight-head: 680;
  --measure-text: 35rem;
  --measure-wide: 48rem;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #0f1115;
    --card: #171a20;
    --wash: #1e232b;
    --ink: #e6e9ef;
    --ink-soft: #a6adba;
    --ink-faint: #6f7784;
    --rule: #262b34;
    --accent: #7aa7ff;
  }
}
body { line-height: 1.62; }
figure.cite {
  margin: 1.6rem auto;
  background: var(--card);
  border: 1px solid var(--rule);
  border-radius: 8px;
  overflow: hidden;
}
.cite-head {
  display: flex;
  align-items: baseline;
  gap: .5rem;
  padding: .45rem .8rem;
  background: var(--wash);
  border-bottom: 1px solid var(--rule);
  color: var(--ink-soft);
}
.cite-lines { margin-right: auto; }
.cite pre.shiki { padding: .7rem 0; }
figure.cite figcaption {
  padding: .55rem .85rem .65rem;
  border-top: 1px solid var(--rule);
  background: var(--paper);
  font-size: .88rem;
  color: var(--ink-soft);
}
`;

/**
 * Press. Big serif headings against sans-serif body, citations separated by
 * hairlines rather than boxes, and the most air between sections. Built for
 * reading top to bottom in one pass.
 */
const PRESS = `
:root {
  --paper: #fffefc;
  --card: #fffefc;
  --wash: #f3f2ee;
  --ink: #121212;
  --ink-soft: #4f4f4d;
  --ink-faint: #8d8d88;
  --rule: #e6e4de;
  --accent: #1c5c4a;
  --font-prose: ${SANS};
  --font-head: ${SERIF};
  --font-ui: ${SANS};
  --font-mono: ${MONO};
  --size-prose: 1.05rem;
  --size-code: .83rem;
  --size-h1: 2.6rem;
  --size-h2: 1.75rem;
  --size-h3: 1.12rem;
  --weight-head: 700;
  --measure-text: 33rem;
  --measure-wide: 46rem;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #121211;
    --card: #121211;
    --wash: #1e1e1c;
    --ink: #f0efec;
    --ink-soft: #adaca7;
    --ink-faint: #74736e;
    --rule: #2b2a27;
    --accent: #6fbba4;
  }
}
h2 { margin-top: 4rem; }
h2::after {
  content: "";
  display: block;
  width: 2.2rem;
  border-top: 3px solid var(--ink);
  margin-top: .55rem;
}
figure.cite {
  margin: 1.9rem auto;
  border-top: 1px solid var(--ink);
  border-bottom: 1px solid var(--rule);
  background: var(--card);
}
.cite-head {
  display: flex;
  align-items: baseline;
  gap: .5rem;
  padding: .35rem 0 .3rem;
  color: var(--ink-faint);
  text-transform: none;
}
.cite-lines { margin-right: auto; }
.cite pre.shiki { padding: .5rem 0 .7rem; }
figure.cite figcaption {
  padding: .5rem 0 .6rem;
  border-top: 1px dotted var(--rule);
  font-size: .9rem;
  color: var(--ink-soft);
  max-width: var(--measure-text);
}
`;

export const SKINS = { paper: PAPER, panel: PANEL, press: PRESS } as const;

export type SkinName = keyof typeof SKINS;

export const DEFAULT_SKIN: SkinName = 'paper';

export function isSkinName(value: string): value is SkinName {
  return value in SKINS;
}
