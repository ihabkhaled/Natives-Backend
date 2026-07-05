import { Module } from '@nestjs/common';

import { ArticlesController } from './api/articles.controller';
import { ArticlesService } from './application/articles.service';
import { ArticleRepository } from './infrastructure/article.repository';

@Module({
  controllers: [ArticlesController],
  providers: [ArticlesService, ArticleRepository],
  exports: [ArticlesService],
})
export class ArticlesModule {}
