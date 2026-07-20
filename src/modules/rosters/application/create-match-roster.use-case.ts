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
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { assertRosterConstraints } from '../domain/roster-content.policy';
import { RosterRepository } from '../infrastructure/roster.repository';
import { RosterEntryRepository } from '../infrastructure/roster-entry.repository';
import { toSnapshotEntries } from '../lib/roster-snapshot.factory';
import {
  buildCarriedEntryWrite,
  buildNewMatchRoster,
  buildRosterAudit,
  buildRosterCreatedEvent,
} from '../lib/rosters.builders';
import { toRosterConstraints } from '../lib/rosters-command.mapper';
import {
  FIRST_REVISION,
  ROSTER_CREATED_ACTION,
} from '../model/rosters.constants';
import { RosterKind } from '../model/rosters.enums';
import type {
  CreateMatchRosterCommand,
  Roster,
  RosterScope,
} from '../model/rosters.types';
import { RosterLookupService } from './roster-lookup.service';
import { RosterScopeService } from './roster-scope.service';

/**
 * Creates a DRAFT match roster for one fixture (roster.manage). When a source
 * roster is named its ACTIVE entries are copied as they stand right now — a
 * point-in-time copy, never a live link — so editing the match line-up can never
 * disturb the competition roster it came from, and vice versa. Roster, entries,
 * audit, and the created event all commit in one transaction.
 */
@Injectable()
export class CreateMatchRosterUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: RosterScopeService,
    private readonly lookup: RosterLookupService,
    private readonly rosters: RosterRepository,
    private readonly entries: RosterEntryRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateMatchRosterCommand,
  ): Promise<Roster> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateMatchRosterCommand,
  ): Promise<Roster> {
    const { content } = command;
    const resolved = await this.scope.forFixture(tx, teamId, content.fixtureId);
    assertRosterConstraints(toRosterConstraints(content));
    const roster = await this.insert(tx, actor, teamId, resolved, command);
    return this.finish(tx, actor, roster, content.sourceRosterId);
  }

  private insert(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    resolved: RosterScope,
    command: CreateMatchRosterCommand,
  ): Promise<Roster> {
    const { content } = command;
    return this.rosters.insert(
      tx,
      buildNewMatchRoster(
        this.idGenerator.generate(),
        teamId,
        resolved.seasonId,
        resolved.competitionId,
        content.fixtureId,
        content.sourceRosterId,
        content.name,
        toRosterConstraints(content),
        content.notes,
        RosterKind.Match,
        FIRST_REVISION,
        actor.userId,
        this.clock.now(),
      ),
    );
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    roster: Roster,
    sourceRosterId: string | null,
  ): Promise<Roster> {
    const copied = await this.copy(tx, actor, roster, sourceRosterId);
    await this.audit.record(
      tx,
      buildRosterAudit(ROSTER_CREATED_ACTION, actor.userId, roster),
    );
    await this.events.enqueue(
      tx,
      buildRosterCreatedEvent(roster, actor.userId, copied),
    );
    return roster;
  }

  private async copy(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    roster: Roster,
    sourceRosterId: string | null,
  ): Promise<number> {
    if (sourceRosterId === null) {
      return 0;
    }
    const source = await this.lookup.require(tx, roster.teamId, sourceRosterId);
    const frozen = toSnapshotEntries(
      await this.entries.listActive(tx, source.rosterId),
    );
    for (const entry of frozen) {
      await this.entries.upsert(
        tx,
        buildCarriedEntryWrite(
          this.idGenerator.generate(),
          roster.rosterId,
          roster.teamId,
          entry,
          actor.userId,
          this.clock.now(),
        ),
      );
    }
    return frozen.length;
  }
}
