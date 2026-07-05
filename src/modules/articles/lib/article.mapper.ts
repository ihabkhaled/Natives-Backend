import type { ArticleResponseDto } from '../api/dto/article-response.dto';
import type { Article } from '../model/article.types';

export function toArticleResponse(article: Article): ArticleResponseDto {
  return {
    id: article.id,
    title: article.title,
    body: article.body,
    status: article.status,
    createdAt: article.createdAt,
  };
}
