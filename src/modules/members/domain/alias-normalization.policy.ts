/**
 * Pure alias-normalization rules for import matching. Normalization is
 * deterministic and lossy by design: it folds Unicode width/compatibility forms,
 * strips diacritics, lowercases, and collapses whitespace so that visually
 * equivalent legacy spellings resolve to one scoped key. The original raw alias
 * is always stored verbatim alongside the normalized key — a legacy misspelling
 * is recorded, never adopted as canonical terminology.
 */

// Combining diacritical marks (U+0300–U+036F), removed after NFKD decomposition.
const COMBINING_MARKS = /[̀-ͯ]/gu;
const WHITESPACE_RUN = /\s+/gu;

/** Normalize a raw alias into its scoped matching key. */
export function normalizeAlias(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(WHITESPACE_RUN, ' ')
    .trim();
}

/** A normalized alias is usable for matching only when it is non-empty. */
export function isMatchableAlias(raw: string): boolean {
  return normalizeAlias(raw).length > 0;
}

/**
 * True when two raw aliases collapse to the same normalized key. Used to detect
 * a collision before writing, so the caller can raise a clean conflict rather
 * than relying solely on the database partial-unique index.
 */
export function aliasesCollide(first: string, second: string): boolean {
  const normalized = normalizeAlias(first);
  return normalized.length > 0 && normalized === normalizeAlias(second);
}
