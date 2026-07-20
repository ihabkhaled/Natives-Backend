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

import { isRosterFrozen } from '../domain/roster.state-machine';
import {
  evaluateEntryFlags,
  isEntryOverrideMissing,
  isOverrideExercised,
  summarizeEntryFlags,
} from '../domain/roster-entry-eligibility.policy';
import { RosterCandidateNotFoundError } from '../errors/roster-candidate-not-found.error';
import { RosterJerseyConflictError } from '../errors/roster-jersey-conflict.error';
import { RosterLockedError } from '../errors/roster-locked.error';
import { RosterOverrideRequiredError } from '../errors/roster-override-required.error';
import { RosterEntryRepository } from '../infrastructure/roster-entry.repository';
import { RosterSourceRepository } from '../infrastructure/roster-source.repository';
import {
  buildEntryAudit,
  buildRosterEntryWrite,
} from '../lib/rosters.builders';
import {
  ROSTER_ENTRY_ADDED_ACTION,
  ROSTER_ENTRY_OVERRIDDEN_ACTION,
} from '../model/rosters.constants';
import type { EntryFlagCode } from '../model/rosters.enums';
import type {
  AddRosterEntryCommand,
  Roster,
  RosterCandidate,
  RosterEntry,
} from '../model/rosters.types';
import { RosterLookupService } from './roster-lookup.service';

/**
 * Adds a player to a roster (roster.manage). A flagged candidate — suspended,
 * inactive, self-declared unavailable, or outside the season squad — is never
 * excluded automatically: adding them requires an explicit override with a reason
 * (the override endpoint additionally requires the elevated permission), so the
 * decision stays a conscious, audited human one. A frozen roster is refused; the
 * way forward is a revision. Jersey collisions are refused before they reach the
 * unique index so the caller gets a typed 409, not an opaque failure.
 */
@Injectable()
export class AddRosterEntryUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: RosterLookupService,
    private readonly source: RosterSourceRepository,
    private readonly entries: RosterEntryRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    rosterId: string,
    command: AddRosterEntryCommand,
  ): Promise<RosterEntry> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, rosterId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    rosterId: string,
    command: AddRosterEntryCommand,
  ): Promise<RosterEntry> {
    const roster = await this.lookup.require(tx, teamId, rosterId);
    if (isRosterFrozen(roster.status)) {
      throw new RosterLockedError();
    }
    const candidate = await this.candidate(tx, roster, command);
    const flags = evaluateEntryFlags(candidate, roster.squadId !== null);
    if (isEntryOverrideMissing(flags, command.override)) {
      throw new RosterOverrideRequiredError();
    }
    return this.persist(tx, actor, roster, command, candidate, flags);
  }

  private async candidate(
    tx: TransactionScope,
    roster: Roster,
    command: AddRosterEntryCommand,
  ): Promise<RosterCandidate> {
    const found = await this.source.findCandidate(
      tx,
      roster.teamId,
      roster.seasonId,
      roster.rosterId,
      roster.squadId,
      command.content.membershipId,
    );
    if (found === null) {
      throw new RosterCandidateNotFoundError();
    }
    return found;
  }

  private async persist(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    roster: Roster,
    command: AddRosterEntryCommand,
    candidate: RosterCandidate,
    flags: readonly EntryFlagCode[],
  ): Promise<RosterEntry> {
    const write = buildRosterEntryWrite(
      this.idGenerator.generate(),
      roster.rosterId,
      roster.teamId,
      command.content,
      candidate,
      command.override,
      isOverrideExercised(flags, command.override),
      actor.userId,
      this.clock.now(),
    );
    await this.assertJerseyFree(
      tx,
      roster,
      write.jerseyNumber,
      write.membershipId,
    );
    const entry = await this.entries.upsert(tx, write);
    await this.record(tx, actor, roster, entry, flags);
    return entry;
  }

  private async assertJerseyFree(
    tx: TransactionScope,
    roster: Roster,
    jerseyNumber: number | null,
    membershipId: string,
  ): Promise<void> {
    if (jerseyNumber === null) {
      return;
    }
    const holder = await this.entries.findByJersey(
      tx,
      roster.rosterId,
      jerseyNumber,
    );
    if (holder !== null && holder.membershipId !== membershipId) {
      throw new RosterJerseyConflictError();
    }
  }

  private async record(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    roster: Roster,
    entry: RosterEntry,
    flags: readonly EntryFlagCode[],
  ): Promise<void> {
    await this.audit.record(
      tx,
      buildEntryAudit(
        entry.constraintOverridden
          ? ROSTER_ENTRY_OVERRIDDEN_ACTION
          : ROSTER_ENTRY_ADDED_ACTION,
        actor.userId,
        roster,
        entry.membershipId,
        summarizeEntryFlags(flags),
        entry.constraintOverridden,
      ),
    );
  }
}
