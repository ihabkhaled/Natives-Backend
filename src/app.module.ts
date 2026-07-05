import { ConfigModule } from '@config/config.module';
import { CoreModule } from '@core/core.module';
import { LoggerModule } from '@core/logger/logger.module';
import { ArticlesModule } from '@modules/articles';
import { Module } from '@nestjs/common';

/**
 * Root module. Order matters: ConfigModule (global) is validated first, then the
 * global pino LoggerModule, then cross-cutting CoreModule, then feature modules.
 */
@Module({
  imports: [ConfigModule, LoggerModule, CoreModule, ArticlesModule],
})
export class AppModule {}
