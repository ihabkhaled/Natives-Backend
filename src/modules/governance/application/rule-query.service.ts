import type { AuthUserIdentity } from '@core/auth';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { GovernanceScopeRepository } from '../infrastructure/governance-scope.repository';
import { RuleRepository } from '../infrastructure/rule.repository';
import { mergeRuleAckState, toRuleAckState } from '../lib/governance.helpers';
import type {
  GovernanceMembershipRef,
  PageRequest,
  RuleAcknowledgement,
  RuleAcknowledgementPage,
  RuleListFilter,
  TeamRule,
  TeamRuleWithAckPage,
  TeamRuleWithAckState,
} from '../model/governance.types';
import { GovernanceLookupService } from './governance-lookup.service';

/**
 * Read side of versioned team rules: a bounded page and one rule (a miss 404s),
 * each item carrying the CALLER's own acknowledgement state resolved from their
 * active membership (BE-2) — so the member ✔-state survives a reload. The
 * compliance listing pages one rule version's acknowledgements for admins.
 */
@Injectable()
export class RuleQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: RuleRepository,
    private readonly scopes: GovernanceScopeRepository,
    private readonly lookup: GovernanceLookupService,
  ) {}

  listForScope(
    teamId: string,
    actor: AuthUserIdentity,
    filter: RuleListFilter,
    page: PageRequest,
  ): Promise<TeamRuleWithAckPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, actor, filter, page),
    );
  }

  getById(
    teamId: string,
    actor: AuthUserIdentity,
    ruleId: string,
  ): Promise<TeamRuleWithAckState> {
    return this.unitOfWork.runInTransaction(async tx => {
      const rule = await this.lookup.requireRule(tx, teamId, ruleId);
      const enriched = await this.withAckState(tx, teamId, actor, [rule]);
      return enriched[0] ?? toRuleAckState(rule, undefined);
    });
  }

  listAcknowledgements(
    teamId: string,
    ruleId: string,
    page: PageRequest,
  ): Promise<RuleAcknowledgementPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.acknowledgementPage(tx, teamId, ruleId, page),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    actor: AuthUserIdentity,
    filter: RuleListFilter,
    page: PageRequest,
  ): Promise<TeamRuleWithAckPage> {
    const rules = await this.repository.listForScope(tx, teamId, filter, page);
    const total = await this.repository.countForScope(tx, teamId, filter);
    const items = await this.withAckState(tx, teamId, actor, rules);
    return { items, total, limit: page.limit, offset: page.offset };
  }

  private async acknowledgementPage(
    tx: TransactionScope,
    teamId: string,
    ruleId: string,
    page: PageRequest,
  ): Promise<RuleAcknowledgementPage> {
    await this.lookup.requireRule(tx, teamId, ruleId);
    const items = await this.repository.listAcknowledgementsForRule(
      tx,
      teamId,
      ruleId,
      page,
    );
    const total = await this.repository.countAcknowledgementsForRule(
      tx,
      teamId,
      ruleId,
    );
    return { items, total, limit: page.limit, offset: page.offset };
  }

  /** Resolve the caller's active membership and merge their ack state. */
  private async withAckState(
    tx: TransactionScope,
    teamId: string,
    actor: AuthUserIdentity,
    rules: readonly TeamRule[],
  ): Promise<readonly TeamRuleWithAckState[]> {
    const membership = await this.scopes.findActiveMembershipByUser(
      tx,
      teamId,
      actor.userId,
    );
    return mergeRuleAckState(
      rules,
      await this.ownAcks(tx, teamId, membership, rules),
    );
  }

  /** No active membership means no acknowledgements — a null state, honestly. */
  private ownAcks(
    tx: TransactionScope,
    teamId: string,
    membership: GovernanceMembershipRef | null,
    rules: readonly TeamRule[],
  ): Promise<readonly RuleAcknowledgement[]> {
    if (membership === null) {
      return Promise.resolve([]);
    }
    return this.repository.listAcknowledgementsForMembership(
      tx,
      teamId,
      membership.membershipId,
      rules.map(rule => rule.ruleId),
    );
  }
}
