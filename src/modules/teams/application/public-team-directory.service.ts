import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { MemberDirectoryService } from '@modules/members';
import { Inject, Injectable } from '@nestjs/common';

import { TeamNotFoundError } from '../errors/team-not-found.error';
import { StaffAssignmentRepository } from '../infrastructure/staff-assignment.repository';
import { TeamRepository } from '../infrastructure/team.repository';
import { toPublicRosterPlayer } from '../lib/public-directory.mapper';
import type {
  PublicTeamDirectoryView,
  TeamAndStaffDirectory,
} from '../model/public-directory.types';
import { PUBLIC_ROSTER_MAX } from '../model/teams.constants';

/**
 * Read side for the public team directory (@Public, unauthenticated): the
 * team's publishable profile, its staff-with-titles "who's who", and its
 * active roster. Composes the teams module's own reads with the members
 * module's public directory read (via its exported service) — no repository
 * is duplicated, no private field crosses the boundary.
 */
@Injectable()
export class PublicTeamDirectoryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly teams: TeamRepository,
    private readonly staff: StaffAssignmentRepository,
    private readonly members: MemberDirectoryService,
  ) {}

  async getDirectory(slug: string): Promise<PublicTeamDirectoryView> {
    const { profile, staff } = await this.unitOfWork.runInTransaction(scope =>
      this.loadTeamAndStaff(scope, slug),
    );
    const players = await this.members.listActiveMembers(profile.id, {
      limit: PUBLIC_ROSTER_MAX,
      offset: 0,
    });
    return {
      profile,
      staff,
      players: players.items.map(item => toPublicRosterPlayer(item)),
    };
  }

  private async loadTeamAndStaff(
    scope: TransactionScope,
    slug: string,
  ): Promise<TeamAndStaffDirectory> {
    const profile = await this.teams.findPublicProfileBySlug(scope, slug);
    if (profile === null) {
      throw new TeamNotFoundError();
    }
    const staff = await this.staff.listPublicDirectory(scope, profile.id);
    return { profile, staff };
  }
}
