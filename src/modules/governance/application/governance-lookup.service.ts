import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { CaseNotFoundError } from '../errors/case-not-found.error';
import { GovernanceScopeNotFoundError } from '../errors/governance-scope-not-found.error';
import { MeetingNotFoundError } from '../errors/meeting-not-found.error';
import { PositionNotFoundError } from '../errors/position-not-found.error';
import { RuleNotFoundError } from '../errors/rule-not-found.error';
import { TaskNotFoundError } from '../errors/task-not-found.error';
import { DisciplineRepository } from '../infrastructure/discipline.repository';
import { GovernanceDirectoryRepository } from '../infrastructure/governance-directory.repository';
import { GovernanceScopeRepository } from '../infrastructure/governance-scope.repository';
import { MeetingRepository } from '../infrastructure/meeting.repository';
import { RuleRepository } from '../infrastructure/rule.repository';
import { TaskRepository } from '../infrastructure/task.repository';
import type {
  DisciplineCase,
  GovernanceMeeting,
  GovernancePosition,
  GovernanceTask,
  TeamRule,
} from '../model/governance.types';

/**
 * Resolves team-owned governance records, translating a miss into a 404 that
 * hides existence. Only the caller's own team is reachable — a cross-team id is
 * not-found, never a leak. Also validates the team/member scope of a write.
 */
@Injectable()
export class GovernanceLookupService {
  constructor(
    private readonly scopes: GovernanceScopeRepository,
    private readonly rules: RuleRepository,
    private readonly discipline: DisciplineRepository,
    private readonly directory: GovernanceDirectoryRepository,
    private readonly meetings: MeetingRepository,
    private readonly tasks: TaskRepository,
  ) {}

  async requireTeam(scope: TransactionScope, teamId: string): Promise<void> {
    if (!(await this.scopes.activeTeamExists(scope, teamId))) {
      throw new GovernanceScopeNotFoundError();
    }
  }

  async requireMember(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<void> {
    if (!(await this.scopes.membershipExists(scope, teamId, membershipId))) {
      throw new GovernanceScopeNotFoundError();
    }
  }

  async requireRule(
    scope: TransactionScope,
    teamId: string,
    ruleId: string,
  ): Promise<TeamRule> {
    const rule = await this.rules.findForWrite(scope, teamId, ruleId);
    if (rule === null) {
      throw new RuleNotFoundError();
    }
    return rule;
  }

  async requireCase(
    scope: TransactionScope,
    teamId: string,
    caseId: string,
  ): Promise<DisciplineCase> {
    const found = await this.discipline.findForWrite(scope, teamId, caseId);
    if (found === null) {
      throw new CaseNotFoundError();
    }
    return found;
  }

  async requirePosition(
    scope: TransactionScope,
    teamId: string,
    positionId: string,
  ): Promise<GovernancePosition> {
    const position = await this.directory.findPosition(
      scope,
      teamId,
      positionId,
    );
    if (position === null) {
      throw new PositionNotFoundError();
    }
    return position;
  }

  async requireMeeting(
    scope: TransactionScope,
    teamId: string,
    meetingId: string,
  ): Promise<GovernanceMeeting> {
    const meeting = await this.meetings.findForWrite(scope, teamId, meetingId);
    if (meeting === null) {
      throw new MeetingNotFoundError();
    }
    return meeting;
  }

  async requireTask(
    scope: TransactionScope,
    teamId: string,
    taskId: string,
  ): Promise<GovernanceTask> {
    const task = await this.tasks.findForWrite(scope, teamId, taskId);
    if (task === null) {
      throw new TaskNotFoundError();
    }
    return task;
  }
}
