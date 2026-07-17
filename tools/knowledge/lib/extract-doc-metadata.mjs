const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'with',
  'is',
  'are',
  'be',
  'this',
  'that',
  'it',
  'as',
  'by',
  'at',
  'from',
  'every',
  'each',
  'when',
  'never',
  'always',
  'not',
  'no',
  'must',
  'may',
  // Generic recipe-title verbs: nearly every skill is "Add a X" / "Create a
  // Y", so matching on the verb alone drowns out the noun that actually
  // distinguishes one skill from another (rules/22: precision over recall
  // on a signal that fires everywhere).
  'add',
  'create',
  'new',
]);

// Title = the first `# ` (H1) line. House style is `# NN — Title` for
// rules/, `# Title` elsewhere — strip a leading numeric prefix + em-dash.
export function extractTitle(docText) {
  const match = /^#\s+(.+)$/m.exec(docText);
  if (!match) {
    return null;
  }
  return match[1].replace(/^\d+\s*[—-]\s*/, '').trim();
}

// The intent blockquote is the first run of `>` lines. Rules/skills state
// "Implements rule **N** of [00-non-negotiable-rules.md]..."; memory files
// state "Implements the canon in ...". Both are free text we keyword-mine —
// this function returns the raw text, callers decide what to do with it.
export function extractIntentBlockquote(docText) {
  const lines = docText.split(/\r?\n/);
  const quoteLines = [];
  let started = false;

  for (const line of lines) {
    const isQuoteLine = line.startsWith('>');
    if (isQuoteLine) {
      started = true;
      quoteLines.push(line.replace(/^>\s?/, ''));
      continue;
    }
    if (started) {
      break;
    }
  }
  return quoteLines.length > 0 ? quoteLines.join(' ').trim() : null;
}

// The first prose paragraph AFTER the intent blockquote. House-style docs
// often keep the blockquote terse ("Implements rule N...") and put the
// concrete vocabulary (which layer, which file, which keyword a task
// description would actually use) in the paragraph right after it — folding
// this into keyword derivation closes that gap without over-indexing the
// whole document body.
export function extractLeadParagraph(docText) {
  const lines = docText.split(/\r?\n/);
  let index = 0;

  while (index < lines.length && !lines[index].startsWith('>')) {
    index += 1; // skip the title and anything before the blockquote
  }
  while (index < lines.length && lines[index].startsWith('>')) {
    index += 1; // skip the blockquote itself
  }
  while (index < lines.length && lines[index].trim() === '') {
    index += 1; // skip the blank line(s) after it
  }

  const paragraphLines = [];
  while (
    index < lines.length &&
    lines[index].trim() !== '' &&
    !lines[index].startsWith('#')
  ) {
    paragraphLines.push(lines[index]);
    index += 1;
  }

  return paragraphLines.length > 0 ? paragraphLines.join(' ').trim() : null;
}

// Matches "rule **7**", "rules **43**–**46**", "rules 8, 9" — every bolded
// or bare number that appears within a short window after the word
// rule/rules. Deliberately permissive: a doc whose phrasing this misses
// still gets a title/path/keyword record, it just has an empty
// implementsRule array (never throws — see 11-test-strategy.md negative cases).
export function extractImplementsRule(text) {
  if (!text) {
    return [];
  }
  const numbers = new Set();
  // Stop the capture window at the first sentence end, linebreak, or markdown
  // link opener — otherwise "rule **7** of [00-non-negotiable-rules.md]"
  // would swallow the "00" from the filename as a false-positive rule number.
  const windowPattern = /rules?\s+([^.\n[(]{0,40})/gi;
  for (const windowMatch of text.matchAll(windowPattern)) {
    const window = windowMatch[1];
    for (const numberMatch of window.matchAll(/\d{1,3}/g)) {
      numbers.add(Number(numberMatch[0]));
    }
  }
  return [...numbers].sort((a, b) => a - b);
}

// The trailing "Related:" line/section — a `·`-separated or bulleted list of
// markdown links to sibling docs. Extracts every `.md` link target.
export function extractRelatedPaths(docText) {
  const relatedSectionMatch =
    /(?:\*\*Related:\*\*|##\s+Related)([\s\S]*?)(?:\n##|\n---|\n\n---|$)/.exec(
      docText,
    );
  if (!relatedSectionMatch) {
    return [];
  }
  const section = relatedSectionMatch[1];
  const paths = [];
  for (const linkMatch of section.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)) {
    paths.push(linkMatch[1]);
  }
  return paths;
}

// Shared tokenizer — also used by resolve-context.mjs to tokenize task
// queries with the exact same rules used to build keywords[], so a query
// token and a keyword either match exactly or don't (rules/22: one owner).
export function tokenize(text) {
  if (!text) {
    return [];
  }
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOPWORDS.has(token));
}

// Keywords = deduped tokens from the title, the filename (kebab-case split),
// the intent blockquote, and the lead paragraph right after it — the same
// vocabulary a human would scan for.
export function deriveKeywords({ relativePath, title, intent, leadParagraph }) {
  const filenameTokens = tokenize(
    relativePath.split('/').pop().replace(/\.md$/, '').replace(/-/g, ' '),
  );
  const tokens = new Set([
    ...filenameTokens,
    ...tokenize(title),
    ...tokenize(intent),
    ...tokenize(leadParagraph),
  ]);
  return [...tokens].sort();
}

const RULE_FILENAME_PATTERN = /^(\d{2})-/;

// Full per-document record build-manifests.mjs writes into documents.json.
export function extractDocMetadata(relativePath, docText) {
  const filename = relativePath.split('/').pop();
  const title = extractTitle(docText);
  const intent = extractIntentBlockquote(docText);
  const leadParagraph = extractLeadParagraph(docText);
  const root = relativePath.split('/')[0];
  const ruleNumberMatch = RULE_FILENAME_PATTERN.exec(filename);

  return {
    path: relativePath,
    root,
    title,
    ruleNumber:
      root === 'rules' && ruleNumberMatch ? Number(ruleNumberMatch[1]) : null,
    implementsRule: extractImplementsRule(intent),
    keywords: deriveKeywords({ relativePath, title, intent, leadParagraph }),
    relatedPaths: extractRelatedPaths(docText),
  };
}

// Generic GFM table parser: returns an array of row-cell arrays (header row
// included at index 0), skipping the `---|---` separator row. Used to mine
// the existing task-router tables in memory/ai-context-map.md and
// context/codebase-navigation.md instead of hand-duplicating their content.
export function parseMarkdownTable(docText) {
  const rows = [];
  for (const line of docText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
      continue;
    }
    const cells = trimmed
      .slice(1, -1)
      .split('|')
      .map(cell => cell.trim());
    if (cells.every(cell => /^:?-+:?$/.test(cell))) {
      continue;
    }
    rows.push(cells);
  }
  return rows;
}

// Extracts `[text](path)` link targets from a single table cell.
export function extractLinksFromCell(cell) {
  const links = [];
  for (const match of cell.matchAll(/\]\(([^)]+)\)/g)) {
    links.push(match[1]);
  }
  return links;
}
