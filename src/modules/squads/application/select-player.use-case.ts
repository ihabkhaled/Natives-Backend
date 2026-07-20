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

import { computeMemberEligibility } from '../domain/eligibility-signal.policy';
import {
  isOverrideMissing,
  resolvedSelectionOutcome,
} from '../domain/selection-override.policy';
import { isSelectionFrozen } from '../domain/squad.state-machine';
import { CandidateNotFoundError } from '../errors/candidate-not-found.error';
import { EligibilityOverrideRequiredError } from '../errors/eligibility-override-required.error';
import { SquadLockedError } from '../errors/squad-locked.error';
import { SquadEligibilityRepository } from '../infrastructure/squad-eligibility.repository';
import { SquadSelectionRepository } from '../infrastructure/squad-selection.repository';
import {
  buildSelectionAudit,
  buildSelectionEvent,
  buildSelectionWrite,
} from '../lib/squads.builders';
import { summarizeEligibilitySnapshot } from '../lib/squads.helpers';
import {
  SELECTION_OVERRIDDEN_ACTION,
  SELECTION_RECORDED_ACTION,
} from '../model/squads.constants';
import { SelectionEventType } from '../model/squads.enums';
import type {
  MemberEligibility,
  SelectPlayerCommand,
  Squad,
  SquadSelection,
} from '../model/squads.types';
import { SquadLookupService } from './squad-lookup.service';

/**
 * Selects a player into a squad (squad.manage). The eligibility signal never
 * excludes anyone: a flagged (Failed/Warning) candidate is selectable ONLY with an
 * explicit override + reason (the override endpoint additionally requires
 * squad.override_eligibility) — otherwise the request is rejected so the decision
 * stays a conscious human one. Records the eligibility snapshot, a history event,
 * and an audit entry in one transaction. A locked squad is frozen.
 */
@Injectable()
export class SelectPlayerUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: SquadLookupService,
    private readonly eligibility: SquadEligibilityRepository,
    private readonly selections: SquadSelectionRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    squadId: string,
    command: SelectPlayerCommand,
  ): Promise<SquadSelection> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, squadId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    squadId: string,
    command: SelectPlayerCommand,
  ): Promise<SquadSelection> {
    const squad = await this.lookup.require(tx, teamId, squadId);
    if (isSelectionFrozen(squad.status)) {
      throw new SquadLockedError();
    }
    const eligibility = await this.evaluate(
      tx,
      squad,
      command.content.membershipId,
    );
    if (isOverrideMissing(eligibility, command.override)) {
      throw new EligibilityOverrideRequiredError();
    }
    return this.persist(tx, actor, squad, command, eligibility);
  }

  private async evaluate(
    tx: TransactionScope,
    squad: Squad,
    membershipId: string,
  ): Promise<MemberEligibility> {
    const inputs = await this.eligibility.findCandidate(
      tx,
      squad.teamId,
      squad.seasonId,
      squad.squadId,
      membershipId,
    );
    if (inputs === null) {
      throw new CandidateNotFoundError();
    }
    return computeMemberEligibility(inputs, squad.attendanceThresholdPct);
  }

  private async persist(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    squad: Squad,
    command: SelectPlayerCommand,
    eligibility: MemberEligibility,
  ): Promise<SquadSelection> {
    const outcome = resolvedSelectionOutcome(eligibility, command.override);
    const snapshot = summarizeEligibilitySnapshot(outcome, eligibility.signals);
    const selection = await this.selections.upsert(
      tx,
      buildSelectionWrite(
        this.idGenerator.generate(),
        squad.squadId,
        squad.teamId,
        command.content.membershipId,
        command.content.selectionRole,
        command.content.reason,
        command.override,
        snapshot,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.recordHistory(tx, actor, squad, command, snapshot);
    return selection;
  }

  private async recordHistory(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    squad: Squad,
    command: SelectPlayerCommand,
    snapshot: string,
  ): Promise<void> {
    const overridden = command.override !== null;
    await this.selections.appendEvent(
      tx,
      buildSelectionEvent(
        this.idGenerator.generate(),
        squad.squadId,
        command.content.membershipId,
        overridden
          ? SelectionEventType.Overridden
          : SelectionEventType.Selected,
        command.content.selectionRole,
        command.content.reason,
        snapshot,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildSelectionAudit(
        overridden ? SELECTION_OVERRIDDEN_ACTION : SELECTION_RECORDED_ACTION,
        actor.userId,
        squad,
        command.content.membershipId,
        snapshot,
        overridden,
      ),
    );
  }
}
