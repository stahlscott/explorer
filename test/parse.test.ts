import { describe, expect, it } from 'vitest';
import { parseDocument } from '../src/parse.ts';

const FRONT_MATTER = `---
title: Example
sources:
  - id: web
    repo: acme/web
    path: ~/src/web
    head: master
---
`;

describe('parseDocument', () => {
  it('reads the sources declared in front matter', () => {
    const doc = parseDocument(`${FRONT_MATTER}\nSome prose.\n`);

    expect(doc.sources).toEqual([
      {
        id: 'web',
        repo: 'acme/web',
        path: '~/src/web',
        base: null,
        head: 'master',
        prs: [],
        sha: null,
      },
    ]);
  });

  it('keeps front matter keys it does not know about', () => {
    const doc = parseDocument(`---
title: Example
question: >
  What breaks when the remote store is unreachable?
sources:
  - id: web
    path: ~/src/web
    head: master
---
`);

    expect(doc.frontMatter.question).toBe(
      'What breaks when the remote store is unreachable?\n',
    );
  });

  it('reads a head that carries a trailing YAML comment', () => {
    const doc = parseDocument(`---
title: Example
sources:
  - id: web
    path: ~/src/web
    head: feature/statements        # tip of the stack
---
`);

    expect(doc.sources[0]!.head).toBe('feature/statements');
  });
});

describe('parseDocument citations', () => {
  it('parses a citation with an explicit source id and line range', () => {
    const doc = parseDocument(`${FRONT_MATTER}
:::cite web src/a.ts:34-41
:::
`);

    expect(doc.blocks).toContainEqual({
      kind: 'cite',
      sourceId: 'web',
      path: 'src/a.ts',
      start: 34,
      end: 41,
      caption: null,
    });
  });

  it('treats a single line number as a one-line range', () => {
    const doc = parseDocument(`${FRONT_MATTER}
:::cite web src/a.ts:89
:::
`);

    const cite = doc.blocks.find(b => b.kind === 'cite')!;
    expect([cite.start, cite.end]).toEqual([89, 89]);
  });

  it('infers the source id when the document declares exactly one source', () => {
    const doc = parseDocument(`${FRONT_MATTER}
:::cite src/a.ts:1-2
:::
`);

    const cite = doc.blocks.find(b => b.kind === 'cite')!;
    expect(cite.sourceId).toBe('web');
  });

  it('keeps the caption written between the fences', () => {
    const doc = parseDocument(`${FRONT_MATTER}
:::cite web src/a.ts:1-2
The frequency check reads localStorage, not the API.
:::
`);

    const cite = doc.blocks.find(b => b.kind === 'cite')!;
    expect(cite.caption).toBe('The frequency check reads localStorage, not the API.');
  });

  it('splits prose around a citation', () => {
    const doc = parseDocument(`${FRONT_MATTER}
Before.

:::cite web src/a.ts:1-2
:::

After.
`);

    expect(doc.blocks.map(b => b.kind)).toEqual(['prose', 'cite', 'prose']);
    expect((doc.blocks[0] as { markdown: string }).markdown).toContain('Before.');
    expect((doc.blocks[2] as { markdown: string }).markdown).toContain('After.');
  });

  it('ignores a cite directive inside a fenced code block', () => {
    const doc = parseDocument(`${FRONT_MATTER}
Here is how you write one:

\`\`\`markdown
:::cite web src/a.ts:1-2
:::
\`\`\`
`);

    expect(doc.blocks.every(b => b.kind === 'prose')).toBe(true);
  });
});

describe('parseDocument rejections', () => {
  it('rejects a document with no front matter', () => {
    expect(() => parseDocument('Just prose.\n')).toThrow(/front matter/i);
  });

  it('rejects a document that declares no sources', () => {
    expect(() => parseDocument('---\ntitle: Example\n---\n')).toThrow(/source/i);
  });

  it('rejects a citation whose source id is omitted when several are declared', () => {
    const twoSources = `---
title: Example
sources:
  - id: web
    path: ~/src/web
    head: master
  - id: api
    path: ~/src/platform
    head: master
---
`;

    expect(() => parseDocument(`${twoSources}\n:::cite src/a.ts:1-2\n:::\n`))
      .toThrow(/2 sources/);
  });

  it('rejects a citation that never closes', () => {
    expect(() => parseDocument(`${FRONT_MATTER}\n:::cite web src/a.ts:1-2\n`))
      .toThrow(/closing ':::'/);
  });

  it('rejects a citation with no line range', () => {
    expect(() => parseDocument(`${FRONT_MATTER}\n:::cite web src/a.ts\n:::\n`))
      .toThrow(/line range/i);
  });

  it('rejects a citation whose range runs backwards', () => {
    expect(() => parseDocument(`${FRONT_MATTER}\n:::cite web src/a.ts:41-34\n:::\n`))
      .toThrow(/41-34/);
  });
});

describe('parseDocument pull requests', () => {
  it('accepts a list of pull requests on a source', () => {
    const doc = parseDocument(`---
title: Example
sources:
  - id: web
    path: ~/src/web
    head: master
    prs: [12800, 12805]
---
`);

    expect(doc.sources[0]!.prs).toEqual([12800, 12805]);
  });

  it('accepts a single pull request written as a scalar', () => {
    const doc = parseDocument(`---
title: Example
sources:
  - id: api
    path: ~/src/platform
    head: master
    pr: 10095
---
`);

    expect(doc.sources[0]!.prs).toEqual([10095]);
  });
});
