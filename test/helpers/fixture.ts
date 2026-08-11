import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { makeRepo } from './repo.ts';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

/**
 * A document plus the repositories its citations resolve against. The browser
 * suite used to render a real document against the author's own checkouts,
 * which meant the byte-identity test — the one that proves the guarantee —
 * only ran on one machine. Building the repository here makes the expected
 * bytes known by construction, and lets the suite run anywhere.
 */
export interface Corpus {
  /** Path to the markdown document. */
  doc: string;
  /** Source id to the repository its citations read from. */
  directories: Map<string, string>;
  /** How many `:::cite` blocks the document contains. */
  citations: number;
  /** The `repo:` slug the first citation's ask-prompt should name. */
  repoSlug: string;
  /** Text from the front matter `question:`, where there is one. */
  question: string;
}

/**
 * The cited range starts below the module docstring on purpose. Highlighting an
 * excerpt rather than the whole file starts the grammar mid-string and silently
 * drops all colour, and a window that opens inside this docstring is how that
 * bug first showed up.
 */
const GENERATE_PY = `"""Generate one customer statement for one billing period.

The period is half-open: a statement includes its opening day and excludes its
closing one, so two consecutive statements never both count a charge that
landed at midnight.
"""

from decimal import Decimal

OPENING_BALANCE = Decimal("0.00")


def totals_for(charges, credits):
    """Return (billed, credited, net) for one period."""
    billed = sum(charge.amount for charge in charges)
    credited = sum(credit.amount for credit in credits)
    return billed, credited, billed - credited


def generate(account, period, charges, credits):
    billed, credited, net = totals_for(charges, credits)
    if net < OPENING_BALANCE:
        # A credit balance carries forward. Refunding it automatically would
        # move money without anyone asking for it.
        return Statement(account, period, net, carried=True)
    return Statement(account, period, net, carried=False)


class Statement:
    def __init__(self, account, period, net, carried):
        self.account = account
        self.period = period
        self.net = net
        self.carried = carried

    def as_row(self):
        return {"account": self.account.id, "period": self.period.slug, "net": str(self.net), "carried": self.carried, "generated_by": "billing.statements.generate"}
`;

const STATEMENT_LIST_TSX = `import { useMemo } from 'react';

import { useStatement } from './useStatement';

interface Row {
  account: string;
  net: string;
  carried: boolean;
}

type Props<T extends Row> = {
  rows: T[];
  onSelect: (row: T) => void;
};

/** Rows arrive newest-first; the table reads oldest-first. */
export function StatementList<T extends Row>({ rows, onSelect }: Props<T>) {
  const ordered = useMemo(() => [...rows].reverse(), [rows]);

  return (
    <table>
      <tbody>
        {ordered.map(row => (
          <tr key={row.account} onClick={() => onSelect(row)}>
            <td>{row.account}</td>
            <td>{row.carried && 'carried forward'}</td>
            <td>{row.net}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
`;

const USE_STATEMENT_TS = `import { useEffect, useState } from 'react';

export interface Statement {
  account: string;
  net: string;
  carried: boolean;
}

/**
 * Fetched once per account and period. Returns null until the first response
 * lands, so a caller can tell "still loading" from "no statement for this
 * period" without a second flag.
 */
export function useStatement(account: string, period: string): Statement | null {
  const [statement, setStatement] = useState<Statement | null>(null);

  useEffect(() => {
    let live = true;
    fetch(\`/api/accounts/\${account}/statements/\${period}\`)
      .then(response => (response.ok ? response.json() : null))
      .then(body => {
        if (live && body !== null) setStatement(body as Statement);
      });
    return () => {
      live = false;
    };
  }, [account, period]);

  return statement;
}
`;

/** Prose, so the document is tall enough for the scroll-tracking tests. */
function filler(topic: string): string {
  return (
    `Nothing here reads the period's closing day, so a charge that lands at ` +
    `midnight belongs to exactly one statement. That is the whole of the ${topic} ` +
    `contract, and it is easier to state than to verify: the boundary is only ` +
    `visible in the half-open range, never in the totals it produces.\n`
  );
}

export function buildCorpus(): Corpus {
  const api = makeRepo({
    'services/billing/internal/statements/generate.py': GENERATE_PY,
  });
  const web = makeRepo({
    'src/features/statements/StatementList.tsx': STATEMENT_LIST_TSX,
    'src/features/statements/useStatement.ts': USE_STATEMENT_TS,
  });

  const doc = join(mkdtempSync(join(tmpdir(), 'explorer-corpus-')), 'statements.md');
  writeFileSync(
    doc,
    `---
title: Statements — how one period becomes one row
sources:
  - id: api
    repo: acme/platform
    path: ${api.path}
    base: main
    head: main
    sha: ${api.sha}
    pr: 4120
  - id: web
    repo: acme/web
    path: ${web.path}
    base: main
    head: main
    sha: ${web.sha}
    prs: [8801, 8802]
---

A statement is one row per account per period, and the period is half-open. Two
things follow from that and neither is obvious from the call sites: a credit
balance carries forward rather than refunding, and the client cannot tell a
missing statement from one it has not fetched yet.

## The shape

| file | what it is |
|---|---|
| \`api services/billing/internal/statements/generate.py\` | The period rule and the carry-forward decision. |
| \`web src/features/statements/useStatement.ts\` | The fetch, and the null that means two things. |
| \`web src/features/statements/StatementList.tsx\` | Presentation only; reverses the order it is given. |

## A credit balance carries forward

${filler('carry-forward')}
:::cite api services/billing/internal/statements/generate.py:20-25
A negative net returns a statement rather than starting a refund.
:::

${filler('period')}

## The totals are computed before the decision

${filler('totals')}
:::cite api services/billing/internal/statements/generate.py:13-17
Billed and credited are summed separately, so a zero net still has both sides.
:::

## One row carries its own provenance

${filler('provenance')}
:::cite api services/billing/internal/statements/generate.py:35-36
The row names the module that produced it, which is how a bad period is traced back.
:::

## Null means two different things

${filler('loading')}
:::cite web src/features/statements/useStatement.ts:14-23
Null before the first response, and null again when the period has no statement.
:::

:::cite web src/features/statements/useStatement.ts:19
The period is interpolated into the path, so an empty period silently requests a collection.
:::

## The table only presents

${filler('ordering')}
:::cite web src/features/statements/StatementList.tsx:17-22
Rows are reversed for display; nothing here re-reads them.
:::

${filler('display')}

## What I could not determine

Whether any caller distinguishes the two nulls. Both are reachable and neither
is logged, so the question needs a running client rather than the repository.
`,
  );

  return {
    doc,
    directories: new Map([
      ['api', api.path],
      ['web', web.path],
    ]),
    citations: 6,
    repoSlug: 'acme/platform',
    question: '',
  };
}

/** One source, so citations omit the id, and a front matter question to surface. */
export function buildSingleSourceCorpus(): Corpus {
  const web = makeRepo({
    'src/features/statements/useStatement.ts': USE_STATEMENT_TS,
    'src/features/statements/StatementList.tsx': STATEMENT_LIST_TSX,
  });

  const question = 'what does a null statement actually mean';
  const doc = join(mkdtempSync(join(tmpdir(), 'explorer-single-')), 'nulls.md');
  writeFileSync(
    doc,
    `---
title: Statements on the client — what null means
question: >
  When the statements hook returns null, ${question}, and can a caller tell the
  two cases apart?
sources:
  - id: web
    repo: acme/web
    path: ${web.path}
    head: main
    sha: ${web.sha}
---

Null means two things and nothing distinguishes them. The hook returns null
before the first response lands and null again when the period genuinely has no
statement, so every caller that branches on it is guessing.

## The hook

${filler('null')}
:::cite src/features/statements/useStatement.ts:14-23
One null for "not yet", one for "not there".
:::

${filler('fetch')}
:::cite src/features/statements/useStatement.ts:24-27
The cleanup only stops the write; the request itself is not aborted.
:::

## The consumer

${filler('consumer')}
:::cite src/features/statements/StatementList.tsx:17-19
Presentation takes rows, never the hook's null.
:::

${filler('ordering')}

## What I could not determine

Whether any caller needs the difference. Nothing logs either case.
`,
  );

  return {
    doc,
    directories: new Map([['web', web.path]]),
    citations: 3,
    repoSlug: 'acme/web',
    question,
  };
}

/** Render a corpus document to a temporary artifact and return its path. */
export function render(doc: string, style?: string): string {
  const out = join(mkdtempSync(join(tmpdir(), 'explorer-artifact-')), 'artifact.html');
  const args = ['--experimental-strip-types', 'src/cli.ts', 'render', doc, '-o', out];
  if (style !== undefined) args.push('--style', style);
  execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  return out;
}
