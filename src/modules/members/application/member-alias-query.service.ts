import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { MemberAliasRepository } from '../infrastructure/member-alias.repository';
import { toListAliasesResponse } from '../lib/member.mapper';
import { ALIAS_LIST_MAX } from '../model/members.constants';
import type { ListAliasesResponse } from '../model/members.types';
import { MemberLookupService } from './member-lookup.service';

/**
 * Read side for a member's aliases. Aliases are import/matching data (restricted
 * to alias managers) — the route enforces member.aliases.manage. Bounded and
 * deterministically ordered; the normalized key is never exposed.
 */
@Injectable()
export class MemberAliasQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: MemberLookupService,
    private readonly aliases: MemberAliasRepository,
  ) {}

  listAliases(
    teamId: string,
    membershipId: string,
  ): Promise<ListAliasesResponse> {
    return this.unitOfWork.runInTransaction(scope =>
      this.load(scope, teamId, membershipId),
    );
  }

  private async load(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<ListAliasesResponse> {
    await this.lookup.requireMembership(scope, teamId, membershipId);
    const items = await this.aliases.listByMembership(
      scope,
      membershipId,
      ALIAS_LIST_MAX,
    );
    return toListAliasesResponse(items);
  }
}
