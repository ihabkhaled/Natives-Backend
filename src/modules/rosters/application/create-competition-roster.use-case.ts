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

import { deduplicateJerseys } from '../domain/roster-composition.policy';
import { assertRosterConstraints } from '../domain/roster-content.policy';
import { RosterRepository } from '../infrastructure/roster.repository';
import { RosterEntryRepository } from '../infrastructure/roster-entry.repository';
import { RosterSourceRepository } from '../infrastructure/roster-source.repository';
import {
  buildGeneratedEntryWrite,
  buildNewCompetitionRoster,
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
  CreateCompetitionRosterCommand,
  Roster,
  RosterScope,
} from '../model/rosters.types';
import { RosterScopeService } from './roster-scope.service';

/**
 * Creates a DRAFT competition roster (roster.manage). When a season squad is
 * named, the roster is GENERATED from that squad's active selections at creation
 * time and then lives its own life: it is a copy, not a view, so a later squad
 * change never silently rewrites a roster. The expansion is hard-capped by the
 * source repository. Roster, entries, audit, and the created event all commit in
 * one transaction.
 */
@Injectable()
export class CreateCompetitionRosterUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: RosterScopeService,
    private readonly rosters: RosterRepository,
    private readonly entries: RosterEntryRepository,
    private readonly source: RosterSourceRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateCompetitionRosterCommand,
  ): Promise<Roster> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateCompetitionRosterCommand,
  ): Promise<Roster> {
    const { content } = command;
    const resolved = await this.scope.forCompetition(
      tx,
      teamId,
      content.competitionId,
      content.squadId,
    );
    assertRosterConstraints(toRosterConstraints(content));
    const roster = await this.insert(tx, actor, teamId, resolved, command);
    return this.finish(tx, actor, roster, content.squadId);
  }

  private insert(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    resolved: RosterScope,
    command: CreateCompetitionRosterCommand,
  ): Promise<Roster> {
    const { content } = command;
    return this.rosters.insert(
      tx,
      buildNewCompetitionRoster(
        this.idGenerator.generate(),
        teamId,
        resolved.seasonId,
        resolved.competitionId,
        content.squadId,
        content.name,
        toRosterConstraints(content),
        content.selectionDeadline,
        content.notes,
        RosterKind.Competition,
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
    squadId: string | null,
  ): Promise<Roster> {
    const generated = await this.generate(tx, actor, roster, squadId);
    await this.audit.record(
      tx,
      buildRosterAudit(ROSTER_CREATED_ACTION, actor.userId, roster),
    );
    await this.events.enqueue(
      tx,
      buildRosterCreatedEvent(roster, actor.userId, generated),
    );
    return roster;
  }

  private async generate(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    roster: Roster,
    squadId: string | null,
  ): Promise<number> {
    if (squadId === null) {
      return 0;
    }
    const candidates = deduplicateJerseys(
      await this.source.listSquadSelections(
        tx,
        roster.teamId,
        roster.seasonId,
        roster.rosterId,
        squadId,
      ),
    );
    for (const candidate of candidates) {
      await this.entries.upsert(
        tx,
        buildGeneratedEntryWrite(
          this.idGenerator.generate(),
          roster.rosterId,
          roster.teamId,
          candidate,
          actor.userId,
          this.clock.now(),
        ),
      );
    }
    return candidates.length;
  }
}
