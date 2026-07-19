import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { computeAward, resolvePointEntry } from '../domain/points-award.policy';
import { PointsLedgerRepository } from '../infrastructure/points-ledger.repository';
import { PointsRuleRepository } from '../infrastructure/points-rule.repository';
import {
  buildAwardEntry,
  buildLedgerAudit,
  buildPointsAwardedEvent,
} from '../lib/points.builders';
import { POINTS_AWARDED_ACTION } from '../model/points.constants';
import type {
  ActivityAwardCommand,
  ActivityTypePoints,
  AwardDecision,
  BadgeScope,
  LedgerEntry,
  PointsRule,
} from '../model/points.types';
import { BadgeSyncService } from './badge-sync.service';

/**
 * The one atomic, idempotent award service the review flow invokes inside its own
 * transaction when an activity claim is APPROVED. It prices the activity by the
 * single PUBLISHED rule version (per-category value, daily cap, cooldown), appends
 * exactly one ledger AWARD (idempotent by submission + rule), then syncs badges,
 * audit, and the outbox. No published rule, no catalog value, or a capped/cooled
 * occurrence simply awards nothing — never a guessed zero.
 */
@Injectable()
export class AwardActivityPointsService {
  constructor(
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly rules: PointsRuleRepository,
    private readonly ledger: PointsLedgerRepository,
    private readonly badges: BadgeSyncService,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  async awardForApproval(
    scope: TransactionScope,
    command: ActivityAwardCommand,
  ): Promise<void> {
    const rule = await this.rules.findPublished(scope, command.teamId);
    if (rule === null) {
      return;
    }
    const type = await this.ledger.findActivityTypePoints(
      scope,
      command.activityTypeId,
    );
    if (type !== null) {
      await this.applyAward(scope, command, rule, type);
    }
  }

  private async applyAward(
    scope: TransactionScope,
    command: ActivityAwardCommand,
    rule: PointsRule,
    type: ActivityTypePoints,
  ): Promise<void> {
    const decision = await this.decide(scope, command, rule, type);
    if (decision.awarded) {
      await this.persist(scope, command, rule, type.category, decision.amount);
    }
  }

  private async decide(
    scope: TransactionScope,
    command: ActivityAwardCommand,
    rule: PointsRule,
    type: ActivityTypePoints,
  ): Promise<AwardDecision> {
    const entry = resolvePointEntry(rule.pointEntries, type.category);
    const facts = await this.ledger.awardFacts(
      scope,
      command.membershipId,
      type.category,
      command.performedOn,
    );
    return computeAward({
      entry,
      pointsApproval: type.pointsApproval,
      facts,
      performedOn: command.performedOn,
    });
  }

  private async persist(
    scope: TransactionScope,
    command: ActivityAwardCommand,
    rule: PointsRule,
    category: string,
    amount: number,
  ): Promise<void> {
    const entry = await this.insertAward(
      scope,
      command,
      rule,
      category,
      amount,
    );
    if (entry !== null) {
      await this.recordAward(scope, command, entry);
    }
  }

  private insertAward(
    scope: TransactionScope,
    command: ActivityAwardCommand,
    rule: PointsRule,
    category: string,
    amount: number,
  ): Promise<LedgerEntry | null> {
    return this.ledger.insert(
      scope,
      buildAwardEntry(
        this.idGenerator.generate(),
        command,
        rule,
        category,
        amount,
        this.clock.now(),
      ),
    );
  }

  private async recordAward(
    scope: TransactionScope,
    command: ActivityAwardCommand,
    entry: LedgerEntry,
  ): Promise<void> {
    await this.badges.sync(scope, this.scopeOf(command), this.clock.now());
    await this.audit.record(
      scope,
      buildLedgerAudit(POINTS_AWARDED_ACTION, command.actorUserId, entry),
    );
    await this.events.enqueue(scope, buildPointsAwardedEvent(entry));
  }

  private scopeOf(command: ActivityAwardCommand): BadgeScope {
    return {
      teamId: command.teamId,
      membershipId: command.membershipId,
      actorUserId: command.actorUserId,
    };
  }
}
