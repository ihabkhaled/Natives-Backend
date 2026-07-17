import { ArticleStatus } from '../model/article.enums';
import type { Article, CreateArticleInput } from '../model/article.types';

/**
 * Domain factory: creates a complete Article from validated inputs. The caller
 * supplies identity and timestamp via injected ports, keeping the factory pure
 * and testable. See context/architecture-map.md §3.
 */
export function createArticle(input: CreateArticleInput): Article {
  return {
    id: input.id,
    title: input.data.title,
    body: input.data.body,
    status: ArticleStatus.Draft,
    ownerId: input.ownerId,
    createdAt: input.createdAt.toISOString(),
  };
}
