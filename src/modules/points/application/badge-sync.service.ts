import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { RecordDomainEventService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { badgesToAward } from '../domain/badge-award.policy';
import { BadgeRepository } from '../infrastructure/badge.repository';
import { PointsLedgerRepository } from '../infrastructure/points-ledger.repository';
import {
  buildBadgeEarnedEvent,
  buildPlayerBadge,
} from '../lib/points.builders';
import type {
  BadgeDefinition,
  BadgeScope,
  PlayerBadge,
} from '../model/points.types';

/**
 * Awards any badge tiers a member has newly crossed after a ledger change. The
 * total is re-projected from the ledger (never a stored counter), compared against
 * the ACTIVE definitions, and each newly-crossed tier is inserted idempotently and
 * announced through the outbox. A retried event never doubles a badge.
 */
@Injectable()
export class BadgeSyncService {
  constructor(
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly ledger: PointsLedgerRepository,
    private readonly badges: BadgeRepository,
    private readonly events: RecordDomainEventService,
  ) {}

  async sync(
    scope: TransactionScope,
    target: BadgeScope,
    now: Date,
  ): Promise<void> {
    const total = await this.ledger.totalFor(scope, target.membershipId);
    const definitions = await this.badges.listActive(scope, target.teamId);
    const earned = await this.badges.earnedDefinitionIds(
      scope,
      target.membershipId,
    );
    const crossed = badgesToAward(definitions, total, new Set(earned));
    await this.awardEach(scope, target, crossed, total, now);
  }

  private async awardEach(
    scope: TransactionScope,
    target: BadgeScope,
    definitions: readonly BadgeDefinition[],
    total: number,
    now: Date,
  ): Promise<void> {
    for (const definition of definitions) {
      await this.awardOne(scope, target, definition, total, now);
    }
  }

  private async awardOne(
    scope: TransactionScope,
    target: BadgeScope,
    definition: BadgeDefinition,
    total: number,
    now: Date,
  ): Promise<void> {
    const badge = await this.insertBadge(scope, target, definition, total, now);
    if (badge !== null) {
      await this.events.enqueue(
        scope,
        buildBadgeEarnedEvent(target, definition, total),
      );
    }
  }

  private insertBadge(
    scope: TransactionScope,
    target: BadgeScope,
    definition: BadgeDefinition,
    total: number,
    now: Date,
  ): Promise<PlayerBadge | null> {
    return this.badges.insertPlayerBadge(
      scope,
      buildPlayerBadge(
        this.idGenerator.generate(),
        target,
        definition,
        total,
        now,
      ),
    );
  }
}
