import type { Article } from '../model/article.types';

export function isArticleOwnedBy(
  article: Article,
  requesterId: string,
): boolean {
  return article.ownerId === requesterId;
}
