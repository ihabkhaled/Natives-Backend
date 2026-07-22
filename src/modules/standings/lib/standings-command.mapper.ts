import {
  DEFAULT_LOSS_POINTS,
  DEFAULT_TIE_BREAK_ORDER,
  DEFAULT_TIE_POINTS,
  DEFAULT_WIN_POINTS,
} from '../model/standings.constants';
import {
  AchievementVisibility,
  StandingQualification,
} from '../model/standings.enums';
import type {
  AchievementContent,
  AchievementContentInput,
  AchievementImportRow,
  AchievementImportRowInput,
  AchievementListFilter,
  AchievementListFilterInput,
  ManualStandingContent,
  ManualStandingContentInput,
  StandingListFilter,
  StandingListFilterInput,
  StandingsRuleContent,
  StandingsRuleContentInput,
} from '../model/standings.types';

/**
 * Normalizes loosely-typed transport input into the strict command shapes. An
 * absent spirit score or final place stays null — not scored and not placed are
 * facts, never zero — and an absent tie-break order copies the documented
 * default INTO the new version so the version remains self-describing.
 */
export function toStandingsRuleContent(
  input: StandingsRuleContentInput,
): StandingsRuleContent {
  return {
    ruleKey: input.ruleKey.trim(),
    name: input.name.trim(),
    winPoints: input.winPoints ?? DEFAULT_WIN_POINTS,
    lossPoints: input.lossPoints ?? DEFAULT_LOSS_POINTS,
    tiePoints: input.tiePoints ?? DEFAULT_TIE_POINTS,
    tieBreakOrder:
      input.tieBreakOrder === undefined || input.tieBreakOrder === null
        ? DEFAULT_TIE_BREAK_ORDER
        : [...input.tieBreakOrder],
  };
}

export function toManualStandingContent(
  input: ManualStandingContentInput,
): ManualStandingContent {
  return {
    competitionId: input.competitionId,
    stageId: input.stageId ?? null,
    poolLabel: input.poolLabel ?? null,
    entrantKind: input.entrantKind,
    opponentId: input.opponentId ?? null,
    played: input.played,
    wins: input.wins,
    losses: input.losses,
    ties: input.ties,
    pointsFor: input.pointsFor,
    pointsAgainst: input.pointsAgainst,
    spiritScore: input.spiritScore ?? null,
    finalPlace: input.finalPlace ?? null,
    qualification: input.qualification ?? StandingQualification.Undecided,
    sourceReference: input.sourceReference ?? null,
    reconciliationNote: input.reconciliationNote.trim(),
    ruleKey: input.ruleKey.trim(),
  };
}

export function toAchievementContent(
  input: AchievementContentInput,
): AchievementContent {
  return {
    seasonId: input.seasonId ?? null,
    competitionId: input.competitionId ?? null,
    membershipId: input.membershipId ?? null,
    category: input.category,
    title: input.title.trim(),
    description: input.description ?? null,
    achievedOn: input.achievedOn,
    evidenceReference: input.evidenceReference ?? null,
    visibility: input.visibility ?? AchievementVisibility.Team,
  };
}

export function toStandingListFilter(
  input: StandingListFilterInput,
): StandingListFilter {
  return {
    competitionId: input.competitionId ?? null,
    stageId: input.stageId ?? null,
    source: input.source ?? null,
  };
}

export function toAchievementListFilter(
  input: AchievementListFilterInput,
): AchievementListFilter {
  return {
    seasonId: input.seasonId ?? null,
    competitionId: input.competitionId ?? null,
    category: input.category ?? null,
    status: input.status ?? null,
    membershipId: input.membershipId ?? null,
  };
}

export function toAchievementImportRow(
  input: AchievementImportRowInput,
): AchievementImportRow {
  return {
    reference: input.reference.trim(),
    category: input.category,
    title: input.title.trim(),
    description: input.description ?? null,
    achievedOn: input.achievedOn,
    seasonId: input.seasonId ?? null,
    competitionId: input.competitionId ?? null,
    evidenceReference: input.evidenceReference ?? null,
    visibility: input.visibility ?? AchievementVisibility.Team,
  };
}

export function toAchievementImportRows(
  inputs: readonly AchievementImportRowInput[],
): readonly AchievementImportRow[] {
  return inputs.map(input => toAchievementImportRow(input));
}
