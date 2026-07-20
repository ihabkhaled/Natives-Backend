import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { MemberDashboardRepository } from '../infrastructure/member-dashboard.repository';
import {
  toMemberCountSignal,
  toProfileSignal,
  UNSCORED_PROFILE_SIGNAL,
} from '../lib/member-signals.mapper';
import type {
  MemberDashboardSignals,
  MemberProfileSignal,
  MemberSignalScope,
} from '../model/members.types';

/**
 * Public members surface for dashboard projections: how complete the viewer's
 * own profile is, and how many invited memberships still await an activation
 * decision. Completeness is scored by the domain policy on read — never stored —
 * and stays null when the viewer has no profile row.
 */
@Injectable()
export class MemberDashboardSignalsService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: MemberDashboardRepository,
  ) {}

  collect(scope: MemberSignalScope): Promise<MemberDashboardSignals> {
    return this.unitOfWork.runInTransaction(tx => this.read(tx, scope));
  }

  private async read(
    tx: TransactionScope,
    scope: MemberSignalScope,
  ): Promise<MemberDashboardSignals> {
    const invited = await this.repository.countInvitedMembers(tx, scope.teamId);
    const profile = await this.readProfile(tx, scope);
    return { ...profile, invitedMembers: toMemberCountSignal(invited) };
  }

  private async readProfile(
    tx: TransactionScope,
    scope: MemberSignalScope,
  ): Promise<MemberProfileSignal> {
    const membershipId = scope.membershipId;
    if (membershipId === null) {
      return UNSCORED_PROFILE_SIGNAL;
    }
    return toProfileSignal(
      await this.repository.findProfileCompleteness(
        tx,
        scope.teamId,
        membershipId,
      ),
    );
  }
}
