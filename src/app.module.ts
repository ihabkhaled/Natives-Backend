import { DatabaseModule } from '@app/database';
import { ConfigModule } from '@config/config.module';
import { CoreModule } from '@core/core.module';
import { LoggerModule } from '@core/logger/logger.module';
import { ActivitiesModule } from '@modules/activities';
import { ArticlesModule } from '@modules/articles';
import { AssessmentsModule } from '@modules/assessments';
import { AuthModule } from '@modules/auth';
import { CompetitionsModule } from '@modules/competitions';
import { DashboardModule } from '@modules/dashboard';
import { DevelopmentModule } from '@modules/development';
import { IdentityModule } from '@modules/identity';
import { MeasurementsModule } from '@modules/measurements';
import { MembersModule } from '@modules/members';
import { PlatformModule } from '@modules/platform';
import { PointsModule } from '@modules/points';
import { PracticesModule } from '@modules/practices';
import { RbacModule } from '@modules/rbac';
import { ScoringModule } from '@modules/scoring';
import { SquadsModule } from '@modules/squads';
import { TeamsModule } from '@modules/teams';
import { Module } from '@nestjs/common';

/**
 * Root module. Order matters: ConfigModule (global) is validated first, then the
 * global pino LoggerModule, then the global DatabaseModule (owns TypeORM/pg),
 * then cross-cutting CoreModule, then feature modules. Global guards are
 * instantiated in create-app.ts via app.useGlobalGuards().
 */
@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    DatabaseModule,
    CoreModule,
    RbacModule,
    AuthModule,
    IdentityModule,
    TeamsModule,
    MembersModule,
    PlatformModule,
    PracticesModule,
    AssessmentsModule,
    DevelopmentModule,
    ScoringModule,
    MeasurementsModule,
    ActivitiesModule,
    PointsModule,
    CompetitionsModule,
    SquadsModule,
    DashboardModule,
    ArticlesModule,
  ],
})
export class AppModule {}
