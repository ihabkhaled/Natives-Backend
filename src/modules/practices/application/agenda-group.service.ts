import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { AttendanceMembershipNotFoundError } from '../errors/attendance-membership-not-found.error';
import { AgendaGroupRepository } from '../infrastructure/agenda-group.repository';
import { AttendanceMembershipRepository } from '../infrastructure/attendance-membership.repository';
import { PracticeAgendaRepository } from '../infrastructure/practice-agenda.repository';
import {
  buildAgendaChildAudit,
  buildNewGroup,
  buildNewGroupMember,
} from '../lib/agendas.builders';
import { toGroupView } from '../lib/agendas.mapper';
import {
  AGENDA_GROUP_MEMBER_SCAN_LIMIT,
  GROUP_CREATED_ACTION,
  GROUP_MEMBER_ASSIGNED_ACTION,
  GROUP_MEMBER_REMOVED_ACTION,
  GROUP_REMOVED_ACTION,
  GROUP_RESOURCE_TYPE,
} from '../model/agendas.constants';
import type {
  Agenda,
  AgendaGroup,
  AssignMembersCommand,
  CreateGroupCommand,
  GroupView,
} from '../model/agendas.types';
import { AgendaLookupService } from './agenda-lookup.service';

/**
 * Authoring of participant groups and their assigned players/coach (drill.manage).
 * Structural, so it requires a DRAFT agenda (publish lock) and bumps the agenda
 * version. Assigned coach and players are validated as active memberships of the
 * team; the unique `(agenda, membership)` index keeps a player in one group and
 * makes a duplicate assign an idempotent no-op.
 */
@Injectable()
export class AgendaGroupService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: AgendaLookupService,
    private readonly groups: AgendaGroupRepository,
    private readonly agendas: PracticeAgendaRepository,
    private readonly memberships: AttendanceMembershipRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  createGroup(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: CreateGroupCommand,
  ): Promise<GroupView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runCreate(scope, actor, teamId, sessionId, command),
    );
  }

  assignMembers(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    groupId: string,
    command: AssignMembersCommand,
  ): Promise<GroupView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runAssign(scope, actor, teamId, sessionId, groupId, command),
    );
  }

  removeMember(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    groupId: string,
    membershipId: string,
  ): Promise<GroupView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runRemoveMember(
        scope,
        actor,
        teamId,
        sessionId,
        groupId,
        membershipId,
      ),
    );
  }

  removeGroup(
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    groupId: string,
  ): Promise<void> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runRemoveGroup(scope, actor, teamId, sessionId, groupId),
    );
  }

  private async runCreate(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    command: CreateGroupCommand,
  ): Promise<GroupView> {
    const agenda = await this.lookup.requireDraft(scope, teamId, sessionId);
    await this.assertCoach(scope, teamId, command.coachMembershipId);
    const group = await this.persistGroup(scope, agenda, command);
    await this.bumpAgenda(scope, agenda, actor);
    await this.recordAudit(
      scope,
      agenda,
      actor,
      GROUP_CREATED_ACTION,
      group.id,
    );
    return toGroupView(group, []);
  }

  private async runAssign(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    groupId: string,
    command: AssignMembersCommand,
  ): Promise<GroupView> {
    const agenda = await this.lookup.requireDraft(scope, teamId, sessionId);
    const group = await this.lookup.requireGroup(scope, agenda.id, groupId);
    await this.assertMembers(scope, teamId, command.membershipIds);
    await this.addMembers(scope, group, command.membershipIds);
    return this.finishGroup(
      scope,
      agenda,
      actor,
      GROUP_MEMBER_ASSIGNED_ACTION,
      group,
    );
  }

  private async runRemoveMember(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    groupId: string,
    membershipId: string,
  ): Promise<GroupView> {
    const agenda = await this.lookup.requireDraft(scope, teamId, sessionId);
    const group = await this.lookup.requireGroup(scope, agenda.id, groupId);
    await this.groups.removeMember(scope, group.id, membershipId);
    return this.finishGroup(
      scope,
      agenda,
      actor,
      GROUP_MEMBER_REMOVED_ACTION,
      group,
    );
  }

  private async finishGroup(
    scope: TransactionScope,
    agenda: Agenda,
    actor: AuthUserIdentity,
    action: string,
    group: AgendaGroup,
  ): Promise<GroupView> {
    await this.bumpAgenda(scope, agenda, actor);
    await this.recordAudit(scope, agenda, actor, action, group.id);
    return this.loadGroupView(scope, group);
  }

  private async runRemoveGroup(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    sessionId: string,
    groupId: string,
  ): Promise<void> {
    const agenda = await this.lookup.requireDraft(scope, teamId, sessionId);
    const group = await this.lookup.requireGroup(scope, agenda.id, groupId);
    await this.groups.removeGroup(scope, agenda.id, group.id);
    await this.bumpAgenda(scope, agenda, actor);
    await this.recordAudit(
      scope,
      agenda,
      actor,
      GROUP_REMOVED_ACTION,
      group.id,
    );
  }

  private async persistGroup(
    scope: TransactionScope,
    agenda: Agenda,
    command: CreateGroupCommand,
  ): Promise<AgendaGroup> {
    const position = await this.groups.nextPosition(scope, agenda.id);
    return this.groups.insertGroup(
      scope,
      buildNewGroup(
        this.idGenerator.generate(),
        agenda,
        position,
        command,
        this.clock.now(),
      ),
    );
  }

  private async addMembers(
    scope: TransactionScope,
    group: AgendaGroup,
    membershipIds: readonly string[],
  ): Promise<void> {
    for (const membershipId of membershipIds) {
      await this.groups.addMember(
        scope,
        buildNewGroupMember(
          this.idGenerator.generate(),
          group,
          membershipId,
          this.clock.now(),
        ),
      );
    }
  }

  private async assertMembers(
    scope: TransactionScope,
    teamId: string,
    membershipIds: readonly string[],
  ): Promise<void> {
    for (const membershipId of membershipIds) {
      if (
        (await this.memberships.findActiveById(scope, teamId, membershipId)) ===
        null
      ) {
        throw new AttendanceMembershipNotFoundError();
      }
    }
  }

  private async assertCoach(
    scope: TransactionScope,
    teamId: string,
    membershipId: string | null,
  ): Promise<void> {
    if (
      membershipId !== null &&
      (await this.memberships.findByIdInTeam(scope, teamId, membershipId)) ===
        null
    ) {
      throw new AttendanceMembershipNotFoundError();
    }
  }

  private async loadGroupView(
    scope: TransactionScope,
    group: AgendaGroup,
  ): Promise<GroupView> {
    const members = await this.groups.listMembersByAgenda(
      scope,
      group.agendaId,
      AGENDA_GROUP_MEMBER_SCAN_LIMIT,
    );
    return toGroupView(group, members);
  }

  private bumpAgenda(
    scope: TransactionScope,
    agenda: Agenda,
    actor: AuthUserIdentity,
  ): Promise<Agenda | null> {
    return this.agendas.bumpVersion(
      scope,
      agenda.id,
      actor.userId,
      null,
      this.clock.now(),
    );
  }

  private recordAudit(
    scope: TransactionScope,
    agenda: Agenda,
    actor: AuthUserIdentity,
    action: string,
    resourceId: string,
  ): Promise<void> {
    return this.audit.record(
      scope,
      buildAgendaChildAudit(
        action,
        GROUP_RESOURCE_TYPE,
        resourceId,
        agenda,
        actor.userId,
        { status: agenda.status },
      ),
    );
  }
}
