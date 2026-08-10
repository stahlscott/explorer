import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { parseDocument } from './parse.ts';
import { resolveDocument } from './resolve.ts';
import { renderDocument } from './render.ts';
import { DEFAULT_SKIN, isSkinName, SKINS } from './styles/skins.ts';

type Write = (line: string) => void;

const CONTEXT_LINES = 12;

const USAGE = `usage: explorer <command> [options]

  render <doc.md> -o <out.html>   resolve every citation and write one self-contained file
  check  <doc.md>                 resolve citations only; print each failure

Options:
  --style <name>   reading surface: ${Object.keys(SKINS).join(", ")} (default ${DEFAULT_SKIN})
  --no-toc         leave out the section nav

Exit codes: 0 ok, 1 the document or its citations failed, 2 wrong usage.`;

interface Loaded {
  citations: number;
  references: number;
  html?: string;
}

/**
 * Parse and resolve, and report every citation failure. Returns null when the
 * document cannot be used, having already written the reasons to `err`.
 */
async function load(
  path: string,
  err: Write,
  wantHtml: boolean,
  skin: string = DEFAULT_SKIN,
  toc = true,
): Promise<Loaded | null> {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    err(`cannot read ${path}`);
    return null;
  }

  let doc;
  try {
    doc = parseDocument(text);
  } catch (error) {
    err(`${path}: ${(error as Error).message}`);
    return null;
  }

  const resolution = resolveDocument(doc, { contextLines: CONTEXT_LINES });
  if (resolution.failures.length > 0) {
    for (const failure of resolution.failures) err(failure.message);
    return null;
  }

  if (!wantHtml) {
    return { citations: resolution.citations.length, references: resolution.references.size };
  }

  return {
    citations: resolution.citations.length,
    references: resolution.references.size,
    html: await renderDocument(doc, resolution, { contextLines: CONTEXT_LINES, skin, toc }),
  };
}

export async function run(argv: string[], out: Write, err: Write): Promise<number> {
  const [command, ...rest] = argv;

  if (command === undefined || command === '--help' || command === '-h' || command === 'help') {
    if (command === undefined) {
      err(USAGE);
      return 2;
    }
    out(USAGE);
    return 0;
  }

  if (command === 'check') {
    const path = rest[0];
    if (path === undefined) {
      err('check needs a document: explorer check <doc.md>');
      return 2;
    }

    const loaded = await load(path, err, false);
    if (!loaded) return 1;

    out(
      `${loaded.citations} citation${loaded.citations === 1 ? '' : 's'} and ` +
        `${loaded.references} file reference${loaded.references === 1 ? '' : 's'} resolved`,
    );
    return 0;
  }

  if (command === 'render') {
    const path = rest[0];
    if (path === undefined) {
      err('render needs a document: explorer render <doc.md> -o <out.html>');
      return 2;
    }

    const flag = rest.indexOf('-o');
    const output = flag === -1 ? undefined : rest[flag + 1];
    if (output === undefined) {
      err('render needs an output path: -o <out.html>');
      return 2;
    }

    const styleFlag = rest.indexOf('--style');
    const styleName = styleFlag === -1 ? DEFAULT_SKIN : rest[styleFlag + 1];
    if (styleName === undefined || !isSkinName(styleName)) {
      err(`unknown style '${styleName ?? ''}'; choose one of ${Object.keys(SKINS).join(', ')}`);
      return 2;
    }

    const loaded = await load(path, err, true, styleName, !rest.includes('--no-toc'));
    // Nothing is written unless every citation resolved.
    if (!loaded?.html) return 1;

    try {
      writeFileSync(output, loaded.html);
    } catch (error) {
      err(`cannot write ${output}: ${(error as Error).message}`);
      return 1;
    }

    out(
      `${output} — ${loaded.citations} citation${loaded.citations === 1 ? '' : 's'}, ` +
        `${loaded.references} file reference${loaded.references === 1 ? '' : 's'}`,
    );
    return 0;
  }

  err(`unknown command '${command}'\n\n${USAGE}`);
  return 2;
}

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return import.meta.filename === realpathSync(entry);
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  const code = await run(
    process.argv.slice(2),
    line => process.stdout.write(`${line}\n`),
    line => process.stderr.write(`${line}\n`),
  );
  process.exit(code);
}
