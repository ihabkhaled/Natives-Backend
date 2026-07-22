import type { AuthUserIdentity } from '@core/auth';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import {
  applyMeetingVisibility,
  canViewMeeting,
} from '../domain/governance-policy';
import { MeetingRepository } from '../infrastructure/meeting.repository';
import type {
  GovernanceMeeting,
  GovernanceMeetingPage,
  GovernanceViewer,
  MeetingListFilter,
  PageRequest,
} from '../model/governance.types';
import { GovernanceAuthorityService } from './governance-authority.service';
import { GovernanceLookupService } from './governance-lookup.service';

/**
 * Read side of governance meetings. Board-visibility minutes are redacted for a
 * caller without the board tier: the meeting still lists (title, time, status),
 * but its confidential minutes and decision register are withheld. A meeting the
 * caller may not see at all does not appear in the list.
 */
@Injectable()
export class MeetingQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: MeetingRepository,
    private readonly lookup: GovernanceLookupService,
    private readonly authority: GovernanceAuthorityService,
  ) {}

  async listForScope(
    actor: AuthUserIdentity,
    teamId: string,
    filter: MeetingListFilter,
    page: PageRequest,
  ): Promise<GovernanceMeetingPage> {
    const viewer = await this.authority.viewerFor(actor, teamId);
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, viewer, filter, page),
    );
  }

  async getById(
    actor: AuthUserIdentity,
    teamId: string,
    meetingId: string,
  ): Promise<GovernanceMeeting> {
    const viewer = await this.authority.viewerFor(actor, teamId);
    return this.unitOfWork.runInTransaction(async tx => {
      const meeting = await this.lookup.requireMeeting(tx, teamId, meetingId);
      if (!canViewMeeting(meeting, viewer)) {
        return applyMeetingVisibility(meeting, viewer);
      }
      return applyMeetingVisibility(meeting, viewer);
    });
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    viewer: GovernanceViewer,
    filter: MeetingListFilter,
    page: PageRequest,
  ): Promise<GovernanceMeetingPage> {
    const rows = await this.repository.listForScope(tx, teamId, filter, page);
    const total = await this.repository.countForScope(tx, teamId, filter);
    const items = rows
      .filter(meeting => canViewMeeting(meeting, viewer))
      .map(meeting => applyMeetingVisibility(meeting, viewer));
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
