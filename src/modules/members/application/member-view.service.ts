import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { classifyAge } from '../domain/member-age.policy';
import { shapeMemberView } from '../domain/member-privacy.policy';
import type { MemberRecord, MemberView } from '../model/members.types';
import { MemberAccessService } from './member-access.service';
import { MemberLookupService } from './member-lookup.service';

/**
 * Read side for a single member: loads the record, resolves the viewer's privacy
 * tier, and returns the field-shaped view (public/teammate/self/coach/admin). No
 * private field is ever included unless the resolved audience permits it.
 */
@Injectable()
export class MemberViewService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: MemberLookupService,
    private readonly access: MemberAccessService,
  ) {}

  async getMember(
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
  ): Promise<MemberView> {
    const record = await this.load(teamId, membershipId);
    const { viewer } = await this.access.resolveAccess(
      actor,
      teamId,
      record.membership,
    );
    const age = classifyAge(record.profile.dateOfBirth, this.clock.now());
    return shapeMemberView(record, viewer, age);
  }

  private load(teamId: string, membershipId: string): Promise<MemberRecord> {
    return this.unitOfWork.runInTransaction(scope =>
      this.lookup.requireRecord(scope, teamId, membershipId),
    );
  }
}
