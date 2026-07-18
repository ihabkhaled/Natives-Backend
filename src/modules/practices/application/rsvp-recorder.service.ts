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

import {
  freedConfirmedSlot,
  resolveWaitlisted,
} from '../domain/rsvp-availability.policy';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { PracticeRsvpRepository } from '../infrastructure/practice-rsvp.repository';
import { PracticeRsvpRevisionRepository } from '../infrastructure/practice-rsvp-revision.repository';
import {
  buildNewRsvp,
  buildPromotionAudit,
  buildPromotionEvent,
  buildPromotionRevision,
  buildRsvpAudit,
  buildRsvpEvent,
  buildRsvpRevision,
  buildRsvpUpdate,
} from '../lib/rsvp.builders';
import { RsvpStatus } from '../model/rsvp.enums';
import type {
  PracticeRsvp,
  RsvpWriteContext,
  RsvpWriteOutcome,
} from '../model/rsvp.types';

/**
 * Records one effective RSVP inside the caller's transaction: it decides
 * confirmed-vs-waitlisted from live capacity, upserts the single effective row
 * under optimistic concurrency, appends an immutable revision, writes an audit
 * row, and enqueues a versioned outbox event (the change/waitlist reminder). When
 * a member vacates a confirmed spot it promotes the earliest waitlisted member in
 * the same transaction. Shared by the self and override use cases; it never opens
 * its own transaction and never awards attendance.
 */
@Injectable()
export class RsvpRecorderService {
  constructor(
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly rsvps: PracticeRsvpRepository,
    private readonly revisions: PracticeRsvpRevisionRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  async record(
    scope: TransactionScope,
    ctx: RsvpWriteContext,
  ): Promise<RsvpWriteOutcome> {
    const existing = await this.rsvps.findBySessionMembership(
      scope,
      ctx.session.id,
      ctx.membershipId,
    );
    const rsvp = await this.persist(scope, ctx, existing);
    await this.recordEffects(scope, ctx, existing, rsvp);
    const promotedMembershipId = await this.maybePromote(
      scope,
      ctx,
      existing,
      rsvp,
    );
    return { rsvp, promotedMembershipId };
  }

  private async persist(
    scope: TransactionScope,
    ctx: RsvpWriteContext,
    existing: PracticeRsvp | null,
  ): Promise<PracticeRsvp> {
    const waitlisted = await this.decideWaitlist(scope, ctx);
    return existing === null
      ? this.insert(scope, ctx, waitlisted)
      : this.update(scope, ctx, existing, waitlisted);
  }

  private async decideWaitlist(
    scope: TransactionScope,
    ctx: RsvpWriteContext,
  ): Promise<boolean> {
    const uncapped =
      ctx.session.capacity === null || ctx.status !== RsvpStatus.Going;
    const confirmed = uncapped
      ? 0
      : await this.rsvps.countConfirmedGoing(
          scope,
          ctx.session.id,
          ctx.membershipId,
        );
    return resolveWaitlisted(ctx.session.capacity, ctx.status, confirmed);
  }

  private async insert(
    scope: TransactionScope,
    ctx: RsvpWriteContext,
    waitlisted: boolean,
  ): Promise<PracticeRsvp> {
    const created = await this.rsvps.insert(
      scope,
      buildNewRsvp(this.idGenerator.generate(), ctx, waitlisted),
    );
    if (created === null) {
      throw new OptimisticConflictError();
    }
    return created;
  }

  private async update(
    scope: TransactionScope,
    ctx: RsvpWriteContext,
    existing: PracticeRsvp,
    waitlisted: boolean,
  ): Promise<PracticeRsvp> {
    this.assertExpectedVersion(existing, ctx);
    const updated = await this.rsvps.update(
      scope,
      buildRsvpUpdate(existing, ctx, waitlisted),
    );
    if (updated === null) {
      throw new OptimisticConflictError();
    }
    return updated;
  }

  private assertExpectedVersion(
    existing: PracticeRsvp,
    ctx: RsvpWriteContext,
  ): void {
    if (
      ctx.expectedVersion !== null &&
      existing.version !== ctx.expectedVersion
    ) {
      throw new OptimisticConflictError();
    }
  }

  private async recordEffects(
    scope: TransactionScope,
    ctx: RsvpWriteContext,
    existing: PracticeRsvp | null,
    rsvp: PracticeRsvp,
  ): Promise<void> {
    await this.revisions.append(
      scope,
      buildRsvpRevision(this.idGenerator.generate(), existing, rsvp, ctx),
    );
    await this.audit.record(scope, buildRsvpAudit(ctx, rsvp));
    await this.events.enqueue(scope, buildRsvpEvent(rsvp, ctx));
  }

  private async maybePromote(
    scope: TransactionScope,
    ctx: RsvpWriteContext,
    existing: PracticeRsvp | null,
    rsvp: PracticeRsvp,
  ): Promise<string | null> {
    if (ctx.session.capacity === null || !freedConfirmedSlot(existing, rsvp)) {
      return null;
    }
    const next = await this.rsvps.findEarliestWaitlisted(scope, ctx.session.id);
    if (next === null) {
      return null;
    }
    return this.promote(scope, ctx, next);
  }

  private async promote(
    scope: TransactionScope,
    ctx: RsvpWriteContext,
    next: PracticeRsvp,
  ): Promise<string | null> {
    const promoted = await this.rsvps.promote(scope, {
      id: next.id,
      updatedBy: ctx.actorUserId,
      expectedVersion: next.version,
      now: ctx.now,
    });
    if (promoted === null) {
      return null;
    }
    await this.recordPromotion(scope, promoted, next, ctx.now);
    return promoted.membershipId;
  }

  private async recordPromotion(
    scope: TransactionScope,
    promoted: PracticeRsvp,
    previous: PracticeRsvp,
    now: Date,
  ): Promise<void> {
    await this.revisions.append(
      scope,
      buildPromotionRevision(
        this.idGenerator.generate(),
        promoted,
        previous,
        now,
      ),
    );
    await this.audit.record(scope, buildPromotionAudit(promoted));
    await this.events.enqueue(scope, buildPromotionEvent(promoted));
  }
}
