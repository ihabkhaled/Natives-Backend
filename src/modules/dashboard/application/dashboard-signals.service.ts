import { AssessmentDashboardSignalsService } from '@modules/assessments';
import { MemberDashboardSignalsService } from '@modules/members';
import { PointsDashboardSignalsService } from '@modules/points';
import { PracticeDashboardSignalsService } from '@modules/practices';
import { Injectable } from '@nestjs/common';

import type {
  DashboardScope,
  DashboardSignalBundle,
} from '../model/dashboard.types';

/**
 * Gathers every signal the summary is projected from, each through its owning
 * module's public surface — the dashboard never reads another context's tables.
 * Collection is sequential on purpose: each source runs one bounded transaction,
 * and the request stays predictable instead of fanning out concurrent work.
 */
@Injectable()
export class DashboardSignalsService {
  constructor(
    private readonly practices: PracticeDashboardSignalsService,
    private readonly assessments: AssessmentDashboardSignalsService,
    private readonly points: PointsDashboardSignalsService,
    private readonly members: MemberDashboardSignalsService,
  ) {}

  async collect(scope: DashboardScope): Promise<DashboardSignalBundle> {
    const practices = await this.practices.collect(scope);
    const assessments = await this.assessments.collect(scope);
    const points = await this.points.standing(scope);
    const members = await this.members.collect(scope);
    return { practices, assessments, points, members };
  }
}
