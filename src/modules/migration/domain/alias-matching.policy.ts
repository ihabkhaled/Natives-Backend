import {
  AUTO_CONFIRM_CONFIDENCE,
  SUGGEST_CONFIDENCE,
} from '../model/migration.constants';
import { AliasResolutionStatus } from '../model/migration.enums';

/**
 * Pure legacy-name matching (UN-703).
 *
 * Normalization folds Unicode, whitespace, Arabic/Latin variants, case,
 * punctuation, and common nicknames so `Mohd.`, `MOHAMED`, and `محمد ` collide
 * on the same key — WITHOUT ever mutating the private source provenance, which
 * is stored verbatim elsewhere. A similarity score drives a candidate, but only
 * a HUMAN confirms an ambiguous one: a candidate below the suggest floor is not
 * even proposed, and anything short of near-certainty stays pending.
 */
const NICKNAMES: ReadonlyMap<string, string> = new Map([
  ['mohd', 'mohamed'],
  ['mo', 'mohamed'],
  ['abd', 'abdel'],
  ['ahmad', 'ahmed'],
]);

export function normalizeAlias(raw: string): string {
  const base = raw
    .normalize('NFKD')
    .replaceAll(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9ء-ي\s]/gu, ' ')
    .trim()
    .replaceAll(/\s+/gu, ' ');
  return base
    .split(' ')
    .map(token => NICKNAMES.get(token) ?? token)
    .join(' ');
}

/**
 * A similarity score in [0, 1] between two normalized aliases: 1 for an exact
 * match, a token-overlap ratio otherwise. Deterministic and symmetric.
 */
export function similarity(left: string, right: string): number {
  if (left === right) {
    return 1;
  }
  const leftTokens = new Set(left.split(' ').filter(token => token.length > 0));
  const rightTokens = new Set(
    right.split(' ').filter(token => token.length > 0),
  );
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }
  const shared = [...leftTokens].filter(token => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return shared / union;
}

/** The initial review status a confidence lands a candidate in. */
export function initialStatusOf(confidence: number): AliasResolutionStatus {
  if (confidence >= AUTO_CONFIRM_CONFIDENCE) {
    return AliasResolutionStatus.Confirmed;
  }
  return AliasResolutionStatus.Pending;
}

/** Whether a candidate is strong enough to even propose to a reviewer. */
export function isSuggestable(confidence: number): boolean {
  return confidence >= SUGGEST_CONFIDENCE;
}

/**
 * Whether confirming this resolution to a membership would collide with an
 * existing active resolution mapping the same person elsewhere — a collision an
 * explicit override must acknowledge, never a silent double-map.
 */
export function isCollision(
  resolvedMembershipId: string | null,
  existingActiveMembershipId: string | null,
  override: boolean,
): boolean {
  if (override || resolvedMembershipId === null) {
    return false;
  }
  return (
    existingActiveMembershipId !== null &&
    existingActiveMembershipId !== resolvedMembershipId
  );
}
