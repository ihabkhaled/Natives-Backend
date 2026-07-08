import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { Module } from '@nestjs/common';

import { ArticlesController } from './api/articles.controller';
import { ArticlesService } from './application/articles.service';
import { ArticleRepository } from './infrastructure/article.repository';

@Module({
  imports: [ClockModule, IdGeneratorModule],
  controllers: [ArticlesController],
  providers: [ArticlesService, ArticleRepository],
  exports: [ArticlesService],
})
export class ArticlesModule {}
