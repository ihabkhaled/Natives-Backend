import { DatabaseModule } from '@app/database';
import { ConfigModule } from '@config/config.module';
import { CoreModule } from '@core/core.module';
import { LoggerModule } from '@core/logger/logger.module';
import { ArticlesModule } from '@modules/articles';
import { AuthModule } from '@modules/auth';
import { IdentityModule } from '@modules/identity';
import { MembersModule } from '@modules/members';
import { PlatformModule } from '@modules/platform';
import { PracticesModule } from '@modules/practices';
import { RbacModule } from '@modules/rbac';
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
    ArticlesModule,
  ],
})
export class AppModule {}
