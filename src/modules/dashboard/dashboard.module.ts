import { ClockModule } from '@core/clock/clock.module';
import { AssessmentsModule } from '@modules/assessments';
import { MembersModule } from '@modules/members';
import { PointsModule } from '@modules/points';
import { PracticesModule } from '@modules/practices';
import { RbacModule } from '@modules/rbac';
import { Module } from '@nestjs/common';

import { DashboardController } from './api/dashboard.controller';
import { DashboardScopeService } from './application/dashboard-scope.service';
import { DashboardSignalsService } from './application/dashboard-signals.service';
import { DashboardSummaryService } from './application/dashboard-summary.service';

/**
 * Dashboard read model. Owns no tables and no writes: it resolves the caller's
 * own team scope and effective permissions, collects bounded signals from the
 * practices, assessments, points, and members contexts through their public
 * surfaces, and projects the widgets the caller may see. Every number it returns
 * is recomputed per request — there is no stored, editable total anywhere in
 * this module.
 */
@Module({
  imports: [
    ClockModule,
    RbacModule,
    MembersModule,
    PracticesModule,
    AssessmentsModule,
    PointsModule,
  ],
  controllers: [DashboardController],
  providers: [
    DashboardScopeService,
    DashboardSignalsService,
    DashboardSummaryService,
  ],
})
export class DashboardModule {}
