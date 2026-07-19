import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  DEVELOPMENT_EVENT_VERSION,
  GOAL_AGGREGATE,
  GOAL_CREATED_EVENT,
  GOAL_OVERDUE_REMINDER_EVENT,
  GOAL_RESOURCE_TYPE,
  GOAL_UPDATED_EVENT,
} from '../model/development.constants';
import { GoalStatus } from '../model/goal.enums';
import type { GoalReminderRow } from '../model/goal.rows';
import type {
  CreateGoalCommand,
  DevelopmentGoal,
  GoalAction,
  NewDevelopmentGoal,
  NewGoalAction,
} from '../model/goal.types';

/** Build a PROPOSED goal from a create command. */
export function buildNewGoal(
  id: string,
  teamId: string,
  command: CreateGoalCommand,
  actorUserId: string,
  now: Date,
): NewDevelopmentGoal {
  return {
    id,
    teamId,
    seasonId: command.seasonId,
    membershipId: command.membershipId,
    status: GoalStatus.Proposed,
    content: command.content,
    createdBy: actorUserId,
    now,
  };
}

/** Map action inputs onto insertable rows, one generated id per action. */
export function buildActionRows(
  goalId: string,
  actions: readonly GoalAction[],
  generateId: () => string,
  now: Date,
): readonly NewGoalAction[] {
  return actions.map(action => ({
    id: generateId(),
    goalId,
    description: action.description,
    sortOrder: action.sortOrder,
    done: action.done,
    dueDate: action.dueDate,
    now,
  }));
}

export function buildGoalAudit(
  action: string,
  actorUserId: string,
  goal: DevelopmentGoal,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: GOAL_RESOURCE_TYPE,
    resourceId: goal.id,
    teamId: goal.teamId,
    seasonId: goal.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: goal.status,
      recordVersion: goal.recordVersion,
    },
  };
}

export function buildGoalCreatedEvent(goal: DevelopmentGoal): DomainEventInput {
  return goalEvent(GOAL_CREATED_EVENT, goal, goal.createdBy);
}

/** GoalUpdated carries only identifiers and status — never any free-text field. */
export function buildGoalUpdatedEvent(
  goal: DevelopmentGoal,
  actorUserId: string,
): DomainEventInput {
  return goalEvent(GOAL_UPDATED_EVENT, goal, actorUserId);
}

export function buildGoalOverdueReminderEvent(
  row: GoalReminderRow,
): DomainEventInput {
  return {
    aggregateType: GOAL_AGGREGATE,
    aggregateId: row.id,
    eventType: GOAL_OVERDUE_REMINDER_EVENT,
    eventVersion: DEVELOPMENT_EVENT_VERSION,
    actorUserId: null,
    teamId: row.team_id,
    seasonId: row.season_id,
    correlationId: null,
    causationId: null,
    payload: {
      goalId: row.id,
      membershipId: row.membership_id,
      dueDate: row.due_date,
    },
  };
}

function goalEvent(
  eventType: string,
  goal: DevelopmentGoal,
  actorUserId: string | null,
): DomainEventInput {
  return {
    aggregateType: GOAL_AGGREGATE,
    aggregateId: goal.id,
    eventType,
    eventVersion: DEVELOPMENT_EVENT_VERSION,
    actorUserId,
    teamId: goal.teamId,
    seasonId: goal.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      goalId: goal.id,
      membershipId: goal.membershipId,
      status: goal.status,
      metricDefinitionId: goal.metricDefinitionId,
    },
  };
}
