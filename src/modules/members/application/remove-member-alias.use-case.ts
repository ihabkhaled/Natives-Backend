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
import { Inject, Injectable } from '@nestjs/common';

import { AliasNotFoundError } from '../errors/alias-not-found.error';
import { MemberAliasRepository } from '../infrastructure/member-alias.repository';
import { MemberAuditRepository } from '../infrastructure/member-audit.repository';
import { MEMBER_ALIAS_REMOVED_EVENT } from '../model/members.constants';
import type { MemberAlias, NewAuditEvent } from '../model/members.types';
import { MemberLookupService } from './member-lookup.service';

/**
 * Soft-removes a member alias (an admin conflict-resolution action). The alias
 * row is retained with a deletion timestamp so lineage survives; the audit
 * records who removed it. Idempotent lookups return a clean 404 for an unknown
 * or already-removed alias.
 */
@Injectable()
export class RemoveMemberAliasUseCase {
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
    aliasId: string,
  ): Promise<void> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, membershipId, aliasId),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    aliasId: string,
  ): Promise<void> {
    await this.lookup.requireMembership(scope, teamId, membershipId);
    const alias = await this.aliases.findActiveById(
      scope,
      membershipId,
      aliasId,
    );
    if (alias === null) {
      throw new AliasNotFoundError();
    }
    const now = this.clock.now();
    await this.aliases.softDelete(scope, aliasId, now);
    await this.audit.append(scope, this.buildAudit(alias, actor, now));
  }

  private buildAudit(
    alias: MemberAlias,
    actor: AuthUserIdentity,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: MEMBER_ALIAS_REMOVED_EVENT,
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
