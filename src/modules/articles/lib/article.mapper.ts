import type { ArticleResponseDto } from '../api/dto/article-response.dto';
import type { ListArticlesResponseDto } from '../api/dto/list-articles.response.dto';
import type { Article, ListArticlesResult } from '../model/article.types';

export function toArticleResponse(article: Article): ArticleResponseDto {
  return {
    id: article.id,
    title: article.title,
    body: article.body,
    status: article.status,
    ownerId: article.ownerId,
    createdAt: article.createdAt,
  };
}

export function toListArticlesResponse(
  result: ListArticlesResult,
): ListArticlesResponseDto {
  return {
    items: result.items.map(article => toArticleResponse(article)),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  };
}
