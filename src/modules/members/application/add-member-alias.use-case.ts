import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import { ValidationError } from '@core/errors/validation.error';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import {
  isMatchableAlias,
  normalizeAlias,
} from '../domain/alias-normalization.policy';
import { AliasConflictError } from '../errors/alias-conflict.error';
import { MemberAliasRepository } from '../infrastructure/member-alias.repository';
import { MemberAuditRepository } from '../infrastructure/member-audit.repository';
import { toAliasResponse } from '../lib/member.mapper';
import {
  ALIAS_INVALID_MESSAGE,
  ALIAS_INVALID_MESSAGE_KEY,
  MEMBER_ALIAS_ADDED_EVENT,
} from '../model/members.constants';
import { AliasSource } from '../model/members.enums';
import type {
  AddAliasCommand,
  AliasResponse,
  MemberAlias,
  NewAuditEvent,
} from '../model/members.types';
import { MemberLookupService } from './member-lookup.service';

/**
 * Adds a normalized alias to a member for import matching. Enforces scoped
 * active-alias uniqueness (a pre-write conflict check backed by a DB partial
 * unique index) so an admin resolving a migration collision gets a clean typed
 * conflict. The raw alias is stored verbatim alongside its normalized key.
 */
@Injectable()
export class AddMemberAliasUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: MemberLookupService,
    private readonly aliases: MemberAliasRepository,
    private readonly audit: MemberAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    command: AddAliasCommand,
  ): Promise<AliasResponse> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, membershipId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    command: AddAliasCommand,
  ): Promise<AliasResponse> {
    await this.lookup.requireMembership(scope, teamId, membershipId);
    if (!isMatchableAlias(command.alias)) {
      throw new ValidationError(
        ALIAS_INVALID_MESSAGE,
        ALIAS_INVALID_MESSAGE_KEY,
      );
    }
    const normalized = normalizeAlias(command.alias);
    const existing = await this.aliases.findActiveByNormalized(
      scope,
      teamId,
      normalized,
    );
    if (existing !== null) {
      throw new AliasConflictError();
    }
    const now = this.clock.now();
    const alias = await this.aliases.insert(scope, {
      id: this.idGenerator.generate(),
      membershipId,
      teamId,
      alias: command.alias,
      normalizedAlias: normalized,
      source: command.source ?? AliasSource.Manual,
      createdBy: actor.userId,
      now,
    });
    await this.audit.append(scope, this.buildAudit(alias, actor, now));
    return toAliasResponse(alias);
  }

  private buildAudit(
    alias: MemberAlias,
    actor: AuthUserIdentity,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: MEMBER_ALIAS_ADDED_EVENT,
      actorUserId: actor.userId,
      context: {
        membershipId: alias.membershipId,
        teamId: alias.teamId,
        aliasId: alias.id,
      },
      occurredAt: now,
    };
  }
}
