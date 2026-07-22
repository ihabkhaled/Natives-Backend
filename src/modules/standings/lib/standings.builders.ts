import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  isApproveTarget,
  isArchiveTarget,
  isRejectTarget,
} from '../domain/achievement.state-machine';
import {
  ACHIEVEMENT_AGGREGATE,
  ACHIEVEMENT_APPROVED_EVENT,
  ACHIEVEMENT_IMPORTED_ACTION,
  ACHIEVEMENT_RESOURCE_TYPE,
  STANDING_AGGREGATE,
  STANDING_RESOURCE_TYPE,
  STANDINGS_EVENT_VERSION,
  STANDINGS_RECOMPUTED_EVENT,
  STANDINGS_RULE_CREATED_ACTION,
  STANDINGS_RULE_RESOURCE_TYPE,
} from '../model/standings.constants';
import type {
  AchievementStatus,
  StandingEntrantKind,
} from '../model/standings.enums';
import {
  AchievementSource,
  StandingQualification,
  StandingSource,
} from '../model/standings.enums';
import type {
  Achievement,
  AchievementContent,
  AchievementImportReport,
  AchievementImportRow,
  AchievementStatusChange,
  CompetitionStanding,
  ManualStandingContent,
  NewAchievement,
  NewStandingsRuleVersion,
  StandingsRecomputeReport,
  StandingsRuleContent,
  StandingsRuleVersion,
  StandingsScope,
  StandingTally,
  StandingUpsert,
} from '../model/standings.types';

// --- Row builders ------------------------------------------------------------

export function buildNewRuleVersion(
  id: string,
  teamId: string,
  content: StandingsRuleContent,
  version: number,
  actorUserId: string,
  now: Date,
): NewStandingsRuleVersion {
  return {
    id,
    teamId,
    ruleKey: content.ruleKey,
    version,
    name: content.name,
    winPoints: content.winPoints,
    lossPoints: content.lossPoints,
    tiePoints: content.tiePoints,
    tieBreakOrder: content.tieBreakOrder,
    effectiveFrom: now,
    createdBy: actorUserId,
  };
}

/** A derived standings row: folded from finalized matches, no manual note. */
export function buildDerivedStanding(
  id: string,
  scope: StandingsScope,
  rule: StandingsRuleVersion,
  stageId: string | null,
  entrantKind: StandingEntrantKind,
  opponentId: string | null,
  tally: StandingTally,
  actorUserId: string,
  now: Date,
): StandingUpsert {
  return {
    id,
    teamId: scope.teamId,
    seasonId: scope.seasonId,
    competitionId: scope.competitionId,
    stageId,
    ruleVersionId: rule.ruleVersionId,
    poolLabel: null,
    entrantKind,
    opponentId,
    tally,
    spiritScore: null,
    finalPlace: null,
    qualification: StandingQualification.Undecided,
    source: StandingSource.Derived,
    sourceReference: null,
    reconciliationNote: null,
    recordedBy: actorUserId,
    now,
  };
}

/**
 * A manually recorded or externally imported standings row. It always carries
 * the operator's reconciliation note — a manual override of a derived table is
 * only trustworthy when the reason it differs is recorded next to it.
 */
/** The raw tally of a manual standing, before the rule scores it. */
export function buildManualTally(
  content: ManualStandingContent,
): StandingTally {
  return {
    played: content.played,
    wins: content.wins,
    losses: content.losses,
    ties: content.ties,
    pointsFor: content.pointsFor,
    pointsAgainst: content.pointsAgainst,
    standingPoints: 0,
  };
}

export function buildManualStanding(
  id: string,
  scope: StandingsScope,
  rule: StandingsRuleVersion,
  content: ManualStandingContent,
  tally: StandingTally,
  actorUserId: string,
  now: Date,
): StandingUpsert {
  return {
    id,
    teamId: scope.teamId,
    seasonId: scope.seasonId,
    competitionId: scope.competitionId,
    stageId: content.stageId,
    ruleVersionId: rule.ruleVersionId,
    poolLabel: content.poolLabel,
    entrantKind: content.entrantKind,
    opponentId: content.opponentId,
    tally,
    spiritScore: content.spiritScore,
    finalPlace: content.finalPlace,
    qualification: content.qualification,
    source: StandingSource.Manual,
    sourceReference: content.sourceReference,
    reconciliationNote: content.reconciliationNote,
    recordedBy: actorUserId,
    now,
  };
}

export function buildNewAchievement(
  id: string,
  teamId: string,
  content: AchievementContent,
  source: AchievementSource,
  importReference: string | null,
  actorUserId: string,
  now: Date,
): NewAchievement {
  return {
    id,
    teamId,
    seasonId: content.seasonId,
    competitionId: content.competitionId,
    membershipId: content.membershipId,
    category: content.category,
    title: content.title,
    description: content.description,
    achievedOn: content.achievedOn,
    evidenceReference: content.evidenceReference,
    visibility: content.visibility,
    source,
    importReference,
    createdBy: actorUserId,
    now,
  };
}

/** An imported historical achievement, carrying its audited source reference. */
export function buildImportedAchievement(
  id: string,
  teamId: string,
  row: AchievementImportRow,
  actorUserId: string,
  now: Date,
): NewAchievement {
  return buildNewAchievement(
    id,
    teamId,
    {
      seasonId: row.seasonId,
      competitionId: row.competitionId,
      membershipId: null,
      category: row.category,
      title: row.title,
      description: row.description,
      achievedOn: row.achievedOn,
      evidenceReference: row.evidenceReference,
      visibility: row.visibility,
    },
    AchievementSource.Import,
    row.reference,
    actorUserId,
    now,
  );
}

export function buildAchievementStatusChange(
  achievement: Achievement,
  target: AchievementStatus,
  actorUserId: string,
  expectedRecordVersion: number,
  now: Date,
): AchievementStatusChange {
  const approving = isApproveTarget(target);
  return {
    id: achievement.achievementId,
    teamId: achievement.teamId,
    expectedRecordVersion,
    toStatus: target,
    approvedBy: approving ? actorUserId : achievement.approvedBy,
    approvedAt: approving ? now : achievement.approvedAt,
    rejectedAt: isRejectTarget(target) ? now : achievement.rejectedAt,
    archivedAt: isArchiveTarget(target) ? now : achievement.archivedAt,
    now,
  };
}

// --- Audit -------------------------------------------------------------------

export function buildRuleAudit(
  actorUserId: string,
  rule: StandingsRuleVersion,
): AuditInput {
  return {
    actorUserId,
    action: STANDINGS_RULE_CREATED_ACTION,
    resourceType: STANDINGS_RULE_RESOURCE_TYPE,
    resourceId: rule.ruleVersionId,
    teamId: rule.teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      ruleKey: rule.ruleKey,
      version: rule.version,
      winPoints: rule.winPoints,
      tiePoints: rule.tiePoints,
      lossPoints: rule.lossPoints,
      tieBreakOrder: rule.tieBreakOrder.join(','),
    },
  };
}

/** Audit a standings write, always recording its provenance. */
export function buildStandingAudit(
  action: string,
  actorUserId: string,
  standing: CompetitionStanding,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: STANDING_RESOURCE_TYPE,
    resourceId: standing.standingId,
    teamId: standing.teamId,
    seasonId: standing.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      competitionId: standing.competitionId,
      entrantKind: standing.entrantKind,
      source: standing.source,
      ruleVersionId: standing.ruleVersionId,
      standingPoints: standing.standingPoints,
      finalPlace: standing.finalPlace,
    },
  };
}

export function buildRecomputeAudit(
  action: string,
  actorUserId: string,
  scope: StandingsScope,
  report: StandingsRecomputeReport,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: STANDING_RESOURCE_TYPE,
    resourceId: report.competitionId,
    teamId: scope.teamId,
    seasonId: scope.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      ruleVersionId: report.ruleVersionId,
      finalizedMatches: report.finalizedMatches,
      entrants: report.entrants,
    },
  };
}

/** Audit an achievement. The description never enters the diff. */
export function buildAchievementAudit(
  action: string,
  actorUserId: string,
  achievement: Achievement,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: ACHIEVEMENT_RESOURCE_TYPE,
    resourceId: achievement.achievementId,
    teamId: achievement.teamId,
    seasonId: achievement.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      category: achievement.category,
      status: achievement.status,
      visibility: achievement.visibility,
      source: achievement.source,
      achievedOn: achievement.achievedOn,
    },
  };
}

export function buildAchievementImportAudit(
  actorUserId: string,
  teamId: string,
  report: AchievementImportReport,
): AuditInput {
  return {
    actorUserId,
    action: ACHIEVEMENT_IMPORTED_ACTION,
    resourceType: ACHIEVEMENT_RESOURCE_TYPE,
    resourceId: null,
    teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      dryRun: report.dryRun,
      received: report.received,
      imported: report.imported,
      skippedDuplicate: report.skippedDuplicate,
      rejectedInvalid: report.rejectedInvalid,
    },
  };
}

// --- Domain events -----------------------------------------------------------

export function buildStandingsRecomputedEvent(
  scope: StandingsScope,
  report: StandingsRecomputeReport,
  actorUserId: string,
): DomainEventInput {
  return {
    aggregateType: STANDING_AGGREGATE,
    aggregateId: report.competitionId,
    eventType: STANDINGS_RECOMPUTED_EVENT,
    eventVersion: STANDINGS_EVENT_VERSION,
    actorUserId,
    teamId: scope.teamId,
    seasonId: scope.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      ruleVersionId: report.ruleVersionId,
      finalizedMatches: report.finalizedMatches,
      entrants: report.entrants,
    },
  };
}

export function buildAchievementApprovedEvent(
  achievement: Achievement,
  actorUserId: string,
): DomainEventInput {
  return {
    aggregateType: ACHIEVEMENT_AGGREGATE,
    aggregateId: achievement.achievementId,
    eventType: ACHIEVEMENT_APPROVED_EVENT,
    eventVersion: STANDINGS_EVENT_VERSION,
    actorUserId,
    teamId: achievement.teamId,
    seasonId: achievement.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      category: achievement.category,
      visibility: achievement.visibility,
      competitionId: achievement.competitionId,
      achievedOn: achievement.achievedOn,
    },
  };
}
