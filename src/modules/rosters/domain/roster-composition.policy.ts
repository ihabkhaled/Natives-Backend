import {
  GENDER_TOKEN_MAN,
  GENDER_TOKEN_NONBINARY,
  GENDER_TOKEN_WOMAN,
} from '../model/rosters.constants';
import {
  ConstraintCode,
  ConstraintSeverity,
  RosterAvailabilityStatus,
  RosterEntryRole,
  RosterEntryStatus,
  RosterGenderBucket,
  RosterLine,
} from '../model/rosters.enums';
import type {
  ConstraintViolation,
  RosterCandidate,
  RosterComposition,
  RosterConstraints,
  RosterEntry,
} from '../model/rosters.types';

/**
 * Pure roster composition rules (UN-502). Counts the active entries and reports
 * every constraint outcome as an explainable code + severity. An `error` blocks
 * publish and lock; a `warning` is advisory and never blocks. The same function
 * powers the draft-time validation preview and the enforcement at publish/lock,
 * so what a coach previews is exactly what the server enforces.
 *
 * Null-not-zero: a null `minWomen` means the division rule does not apply and is
 * never evaluated as "at least zero women"; an undeclared gender lands in the
 * `unknown` bucket and is never counted as men or women.
 */

/** Bucket a raw self-declared profile gender. Unknown is honest, not zero. */
export function bucketGender(raw: string | null): RosterGenderBucket {
  if (raw === GENDER_TOKEN_MAN) {
    return RosterGenderBucket.Men;
  }
  if (raw === GENDER_TOKEN_WOMAN) {
    return RosterGenderBucket.Women;
  }
  if (raw === GENDER_TOKEN_NONBINARY) {
    return RosterGenderBucket.Mixed;
  }
  return RosterGenderBucket.Unknown;
}

/**
 * Resolve a bulk generation so it can never fabricate a jersey collision: the
 * first candidate keeps a repeated number and every later one is recorded with
 * NO jersey. A missing jersey is the honest state ("not issued yet"), surfaced as
 * an advisory warning — it is never invented, and never silently reassigned.
 */
export function deduplicateJerseys(
  candidates: readonly RosterCandidate[],
): readonly RosterCandidate[] {
  const taken = new Set<number>();
  return candidates.map(candidate => {
    if (candidate.jerseyNumber === null) {
      return candidate;
    }
    if (taken.has(candidate.jerseyNumber)) {
      return { ...candidate, jerseyNumber: null };
    }
    taken.add(candidate.jerseyNumber);
    return candidate;
  });
}

/** The active (non-withdrawn) entries a composition is measured over. */
export function activeEntries(
  entries: readonly RosterEntry[],
): readonly RosterEntry[] {
  return entries.filter(entry => entry.status === RosterEntryStatus.Selected);
}

/** Count the shape of a roster's active entries. */
export function summarizeComposition(
  entries: readonly RosterEntry[],
): RosterComposition {
  const active = activeEntries(entries);
  return {
    selected: active.length,
    women: countBucket(active, RosterGenderBucket.Women),
    men: countBucket(active, RosterGenderBucket.Men),
    mixed: countBucket(active, RosterGenderBucket.Mixed),
    unknownGender: countBucket(active, RosterGenderBucket.Unknown),
    offense: countLine(active, RosterLine.Offense),
    defense: countLine(active, RosterLine.Defense),
    flexible: countLine(active, RosterLine.Any),
    captains: countRole(active, RosterEntryRole.Captain),
    spiritCaptains: countRole(active, RosterEntryRole.SpiritCaptain),
    missingJersey: active.filter(entry => entry.jerseyNumber === null).length,
    duplicateJerseys: countDuplicateJerseys(active),
    unavailableSelected: active.filter(
      entry => entry.availability === RosterAvailabilityStatus.Unavailable,
    ).length,
  };
}

/** Every constraint outcome for a composition, in a deterministic order. */
export function evaluateConstraints(
  composition: RosterComposition,
  constraints: RosterConstraints,
): readonly ConstraintViolation[] {
  return [
    ...sizeViolations(composition, constraints),
    ...captainViolations(composition, constraints),
    ...jerseyViolations(composition),
    ...genderViolations(composition, constraints),
    ...advisoryViolations(composition),
  ];
}

/** True when no blocking violation remains — the roster may be frozen. */
export function isPublishable(
  violations: readonly ConstraintViolation[],
): boolean {
  return !violations.some(
    violation => violation.severity === ConstraintSeverity.Error,
  );
}

function sizeViolations(
  composition: RosterComposition,
  constraints: RosterConstraints,
): readonly ConstraintViolation[] {
  if (composition.selected < constraints.minSize) {
    return [violation(ConstraintCode.MinSize, composition.selected)];
  }
  if (composition.selected > constraints.maxSize) {
    return [violation(ConstraintCode.MaxSize, composition.selected)];
  }
  return [];
}

function captainViolations(
  composition: RosterComposition,
  constraints: RosterConstraints,
): readonly ConstraintViolation[] {
  if (constraints.requireCaptain && composition.captains === 0) {
    return [violation(ConstraintCode.MissingCaptain, 0)];
  }
  return [];
}

function jerseyViolations(
  composition: RosterComposition,
): readonly ConstraintViolation[] {
  if (composition.duplicateJerseys > 0) {
    return [
      violation(ConstraintCode.JerseyCollision, composition.duplicateJerseys),
    ];
  }
  return [];
}

function genderViolations(
  composition: RosterComposition,
  constraints: RosterConstraints,
): readonly ConstraintViolation[] {
  if (constraints.minWomen === null) {
    return [];
  }
  if (composition.women < constraints.minWomen) {
    return [violation(ConstraintCode.GenderRatio, composition.women)];
  }
  return [];
}

function advisoryViolations(
  composition: RosterComposition,
): readonly ConstraintViolation[] {
  const advisories: ConstraintViolation[] = [];
  if (composition.missingJersey > 0) {
    advisories.push(
      warning(ConstraintCode.MissingJersey, composition.missingJersey),
    );
  }
  if (composition.unavailableSelected > 0) {
    advisories.push(
      warning(
        ConstraintCode.UnavailableSelected,
        composition.unavailableSelected,
      ),
    );
  }
  if (composition.offense > 0 && composition.defense === 0) {
    advisories.push(warning(ConstraintCode.LineBalance, composition.offense));
  }
  return advisories;
}

function violation(code: ConstraintCode, count: number): ConstraintViolation {
  return { code, severity: ConstraintSeverity.Error, count };
}

function warning(code: ConstraintCode, count: number): ConstraintViolation {
  return { code, severity: ConstraintSeverity.Warning, count };
}

function countBucket(
  entries: readonly RosterEntry[],
  bucket: RosterGenderBucket,
): number {
  return entries.filter(entry => entry.genderBucket === bucket).length;
}

function countLine(entries: readonly RosterEntry[], line: RosterLine): number {
  return entries.filter(entry => entry.lineAssignment === line).length;
}

function countRole(
  entries: readonly RosterEntry[],
  role: RosterEntryRole,
): number {
  return entries.filter(entry => entry.entryRole === role).length;
}

function countDuplicateJerseys(entries: readonly RosterEntry[]): number {
  const seen = new Set<number>();
  let duplicates = 0;
  for (const entry of entries) {
    if (entry.jerseyNumber === null) {
      continue;
    }
    if (seen.has(entry.jerseyNumber)) {
      duplicates += 1;
      continue;
    }
    seen.add(entry.jerseyNumber);
  }
  return duplicates;
}
