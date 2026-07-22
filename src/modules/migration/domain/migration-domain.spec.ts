import { describe, expect, it } from 'vitest';

import {
  DiscrepancyClassification,
  ImportStatus,
} from '../model/migration.enums';
import type { ComparisonInput } from '../model/migration.types';
import {
  initialStatusOf,
  isCollision,
  isSuggestable,
  normalizeAlias,
  similarity,
} from './alias-matching.policy';
import {
  classifyDiscrepancy,
  differenceOf,
  isMissingVsZero,
} from './discrepancy-classification.policy';
import {
  canTransitionImport,
  isCommittable,
  isReversible,
} from './import-job.state-machine';

function comparison(overrides: Partial<ComparisonInput>): ComparisonInput {
  return {
    legacyValue: 10,
    targetValue: 10,
    legacyRuleVersion: 'v1',
    targetRuleVersion: 'v1',
    legacyBroken: false,
    ...overrides,
  };
}

describe('alias matching policy', () => {
  it('normalizes case, accents, punctuation, and nicknames', () => {
    expect(normalizeAlias('Mohd. Ali')).toBe('mohamed ali');
    expect(normalizeAlias('  AHMAD  ')).toBe('ahmed');
    expect(normalizeAlias('José-Luis')).toBe('jose luis');
  });

  it('scores similarity symmetrically', () => {
    expect(similarity('mohamed ali', 'mohamed ali')).toBe(1);
    expect(similarity('mohamed ali', 'mohamed')).toBeCloseTo(0.5);
    expect(similarity('', 'x')).toBe(0);
  });

  it('confirms only near-certain candidates and suggests strong ones', () => {
    expect(initialStatusOf(0.99)).toBe('confirmed');
    expect(initialStatusOf(0.7)).toBe('pending');
    expect(isSuggestable(0.7)).toBe(true);
    expect(isSuggestable(0.3)).toBe(false);
  });

  it('detects a re-bind collision, waived by an override', () => {
    expect(isCollision('member-1', 'member-2', false)).toBe(true);
    expect(isCollision('member-1', 'member-2', true)).toBe(false);
    expect(isCollision('member-1', 'member-1', false)).toBe(false);
    expect(isCollision('member-1', null, false)).toBe(false);
  });
});

describe('discrepancy classification policy', () => {
  it('classifies a match, rounding, and a target bug', () => {
    expect(classifyDiscrepancy(comparison({}))).toBe(
      DiscrepancyClassification.Matching,
    );
    expect(classifyDiscrepancy(comparison({ targetValue: 10.002 }))).toBe(
      DiscrepancyClassification.Rounding,
    );
    expect(classifyDiscrepancy(comparison({ targetValue: 15 }))).toBe(
      DiscrepancyClassification.TargetBug,
    );
  });

  it('never forces the target to match a broken legacy reference', () => {
    expect(
      classifyDiscrepancy(
        comparison({ legacyValue: null, targetValue: 12, legacyBroken: true }),
      ),
    ).toBe(DiscrepancyClassification.BrokenReference);
  });

  it('distinguishes a legacy zero from a target null', () => {
    expect(
      classifyDiscrepancy(comparison({ legacyValue: 0, targetValue: null })),
    ).toBe(DiscrepancyClassification.MissingVsZero);
    expect(
      isMissingVsZero(comparison({ targetValue: 0, legacyValue: null })),
    ).toBe(true);
  });

  it('classifies a version difference', () => {
    expect(
      classifyDiscrepancy(
        comparison({ targetValue: 15, targetRuleVersion: 'v2' }),
      ),
    ).toBe(DiscrepancyClassification.VersionDifference);
  });

  it('reports a privacy exclusion when a value is absent', () => {
    expect(classifyDiscrepancy(comparison({ targetValue: null }))).toBe(
      DiscrepancyClassification.PrivacyExclusion,
    );
    expect(differenceOf(comparison({ targetValue: 15 }))).toBe(5);
    expect(differenceOf(comparison({ targetValue: null }))).toBeNull();
  });
});

describe('import job state machine', () => {
  it('walks the import lifecycle and refuses illegal moves', () => {
    expect(
      canTransitionImport(ImportStatus.Staged, ImportStatus.Committed),
    ).toBe(true);
    expect(
      canTransitionImport(ImportStatus.Committed, ImportStatus.Reversed),
    ).toBe(true);
    expect(
      canTransitionImport(ImportStatus.Reversed, ImportStatus.Staged),
    ).toBe(false);
  });

  it('never commits a dry run and reverses only a committed job', () => {
    expect(isCommittable(ImportStatus.Staged, false)).toBe(true);
    expect(isCommittable(ImportStatus.Staged, true)).toBe(false);
    expect(isCommittable(ImportStatus.Committed, false)).toBe(false);
    expect(isReversible(ImportStatus.Committed)).toBe(true);
    expect(isReversible(ImportStatus.Staged)).toBe(false);
  });
});
