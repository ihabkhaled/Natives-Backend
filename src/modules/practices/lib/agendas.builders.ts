import {
  type AuditInput,
  AuditOutcome,
  type DomainEventInput,
  type ScalarPayload,
} from '@modules/platform';

import {
  AGENDA_AGGREGATE_TYPE,
  AGENDA_EVENT_VERSION,
  AGENDA_RESOURCE_TYPE,
  DRILL_RESOURCE_TYPE,
} from '../model/agendas.constants';
import { CompletionStatus } from '../model/agendas.enums';
import type {
  Agenda,
  AgendaBlock,
  AgendaBlockUpdate,
  AgendaGroup,
  AgendaLifecycleWrite,
  AgendaStation,
  BlockCompletionWrite,
  CompleteBlockCommand,
  CreateAgendaCommand,
  CreateBlockCommand,
  CreateDrillCommand,
  CreateGroupCommand,
  CreateStationCommand,
  Drill,
  DrillUpdate,
  NewAgenda,
  NewAgendaBlock,
  NewAgendaGroup,
  NewAgendaGroupMember,
  NewAgendaStation,
  NewDrill,
  UpdateBlockCommand,
  UpdateDrillCommand,
} from '../model/agendas.types';
import type { PracticeSession } from '../model/practices.types';

/**
 * Pure builders that turn a command (or a resulting row) into the persistence,
 * audit, and outbox-event payloads. Kept free of injected ports so they stay
 * trivially unit-testable and reusable by every write path. Audit diffs and event
 * payloads carry only non-sensitive scalars — never free-text notes, coach notes,
 * objectives, or instructions — so redaction and privacy are total by construction.
 */

// --- Drill catalog -----------------------------------------------------------

export function buildNewDrill(
  id: string,
  teamId: string,
  command: CreateDrillCommand,
  actorUserId: string | null,
  now: Date,
): NewDrill {
  return { ...command, id, teamId, createdBy: actorUserId, now };
}

export function buildDrillUpdate(
  id: string,
  command: UpdateDrillCommand,
  actorUserId: string | null,
  now: Date,
): DrillUpdate {
  return { ...command, id, updatedBy: actorUserId, now };
}

export function buildDrillAudit(
  action: string,
  drill: Drill,
  actorUserId: string | null,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: DRILL_RESOURCE_TYPE,
    resourceId: drill.id,
    teamId: drill.teamId,
    seasonId: drill.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      category: drill.category,
      intensity: drill.intensity,
      status: drill.status,
    },
  };
}

// --- Agenda aggregate --------------------------------------------------------

export function buildNewAgenda(
  id: string,
  session: PracticeSession,
  command: CreateAgendaCommand,
  actorUserId: string | null,
  now: Date,
): NewAgenda {
  return {
    id,
    sessionId: session.id,
    teamId: session.teamId,
    seasonId: session.seasonId,
    theme: command.theme,
    notes: command.notes,
    createdBy: actorUserId,
    now,
  };
}

export function buildAgendaLifecycleWrite(
  agendaId: string,
  actorUserId: string | null,
  expectedVersion: number | null,
  now: Date,
): AgendaLifecycleWrite {
  return { id: agendaId, actorUserId, expectedVersion, now };
}

export function buildAgendaAudit(
  action: string,
  agenda: Agenda,
  actorUserId: string | null,
  diff: ScalarPayload,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: AGENDA_RESOURCE_TYPE,
    resourceId: agenda.id,
    teamId: agenda.teamId,
    seasonId: agenda.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff,
  };
}

export function buildAgendaChildAudit(
  action: string,
  resourceType: string,
  resourceId: string,
  agenda: Agenda,
  actorUserId: string | null,
  diff: ScalarPayload,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType,
    resourceId,
    teamId: agenda.teamId,
    seasonId: agenda.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff,
  };
}

export function buildAgendaEvent(
  eventType: string,
  agenda: Agenda,
  actorUserId: string | null,
  payload: ScalarPayload,
): DomainEventInput {
  return {
    aggregateType: AGENDA_AGGREGATE_TYPE,
    aggregateId: agenda.id,
    eventType,
    eventVersion: AGENDA_EVENT_VERSION,
    actorUserId,
    teamId: agenda.teamId,
    seasonId: agenda.seasonId,
    correlationId: null,
    causationId: null,
    payload,
  };
}

// --- Blocks ------------------------------------------------------------------

export function buildNewBlock(
  id: string,
  agenda: Agenda,
  position: number,
  command: CreateBlockCommand,
  actorUserId: string | null,
  now: Date,
): NewAgendaBlock {
  return {
    ...command,
    id,
    agendaId: agenda.id,
    sessionId: agenda.sessionId,
    teamId: agenda.teamId,
    position,
    createdBy: actorUserId,
    now,
  };
}

export function buildBlockUpdate(
  id: string,
  command: UpdateBlockCommand,
  actorUserId: string | null,
  now: Date,
): AgendaBlockUpdate {
  return { ...command, id, updatedBy: actorUserId, now };
}

export function buildBlockCompletion(
  id: string,
  command: CompleteBlockCommand,
  actorUserId: string | null,
  now: Date,
): BlockCompletionWrite {
  const executed = command.completionStatus !== CompletionStatus.Planned;
  return {
    id,
    completionStatus: command.completionStatus,
    completedBy: executed ? actorUserId : null,
    completedAt: executed ? now : null,
    updatedBy: actorUserId,
    expectedVersion: command.expectedVersion,
    now,
  };
}

// --- Stations ----------------------------------------------------------------

export function buildNewStation(
  id: string,
  block: AgendaBlock,
  position: number,
  command: CreateStationCommand,
  now: Date,
): NewAgendaStation {
  return {
    ...command,
    id,
    blockId: block.id,
    agendaId: block.agendaId,
    teamId: block.teamId,
    position,
    now,
  };
}

// --- Groups ------------------------------------------------------------------

export function buildNewGroup(
  id: string,
  agenda: Agenda,
  position: number,
  command: CreateGroupCommand,
  now: Date,
): NewAgendaGroup {
  return {
    ...command,
    id,
    agendaId: agenda.id,
    teamId: agenda.teamId,
    position,
    now,
  };
}

export function buildNewGroupMember(
  id: string,
  group: AgendaGroup,
  membershipId: string,
  now: Date,
): NewAgendaGroupMember {
  return { id, groupId: group.id, agendaId: group.agendaId, membershipId, now };
}

// --- Copy (template / prior session) -----------------------------------------
// Turn an existing row back into a create command so copy produces fresh rows
// (new ids) that are fully independent of the source — editing the copy never
// touches the source. Drill references are carried by id (the catalog is shared).

export function toBlockCommand(block: AgendaBlock): CreateBlockCommand {
  return {
    drillId: block.drillId,
    title: block.title,
    blockType: block.blockType,
    offsetMinutes: block.offsetMinutes,
    durationMinutes: block.durationMinutes,
    intensity: block.intensity,
    repetitions: block.repetitions,
    target: block.target,
    notes: block.notes,
    coachNotes: block.coachNotes,
  };
}

export function toGroupCommand(group: AgendaGroup): CreateGroupCommand {
  return {
    name: group.name,
    color: group.color,
    coachMembershipId: group.coachMembershipId,
    notes: group.notes,
  };
}

export function toStationCommand(
  station: AgendaStation,
  groupId: string | null,
): CreateStationCommand {
  return {
    drillId: station.drillId,
    groupId,
    coachMembershipId: station.coachMembershipId,
    name: station.name,
    repetitions: station.repetitions,
    target: station.target,
    notes: station.notes,
  };
}
