# 08 — Architecture Review

## Current architecture context

The canonical architecture is one-way layered dependencies:

```
Controller (api/*.controller.ts)
  → Application (application/*.use-case.ts, application/*.service.ts)
    → Domain (domain/)
      → Persistence (infrastructure/*.repository.ts)
        → Integration (adapters/*.adapter.ts)
```

Cross-cutting: `src/core`, `src/config`, `src/shared`.

This is documented in `context/architecture-map.md` and `rules/00-non-negotiable-rules.md` and is mechanically enforced by the ESLint plugin.

## Impact by area

| Area               | Impact                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Controller layer   | No change. Controllers remain thin.                                                                          |
| Application layer  | Strengthened. Services may no longer import API DTOs as I/O contracts.                                       |
| Domain layer       | New. A small `domain/` layer is introduced in the reference app to demonstrate ownership of entity creation. |
| Persistence layer  | Slight contract change: repository receives a complete entity to save rather than raw pieces.                |
| Integration layer  | No new adapters in this scope.                                                                               |
| Cross-cutting      | Logger and validation wrappers remain the same.                                                              |
| ESLint enforcement | Expanded. New rules cover module-level declarations and DTO imports.                                         |

## Boundary changes

- API DTOs are now a controller-only I/O contract; services use model types (`model/*.types.ts`).
- Domain factories own the creation of entities with generated IDs, timestamps, and default status.
- Repositories own only persistence; they do not generate business-level entity state.

## Contract changes

- `ArticlesService.create` input changes from `CreateArticleDto` to `CreateArticleData` (structurally identical, but semantically different).
- `ArticleRepository` gains `save(article: Article)` and loses `create(id, data, createdAt)`.
- HTTP contract is unchanged: request/response DTO shapes stay the same.

## Data-flow changes

```
POST /api/v1/articles
  → Controller receives CreateArticleDto
  → Service receives CreateArticleData
  → Domain factory creates Article with id, status, createdAt
  → Repository saves Article
  → Mapper returns ArticleResponseDto
```

## ADR decision

No new ADR is required. The changes reinforce the existing architecture map and the non-negotiable rules. If a future change requires a larger deviation, an ADR will be written under `architecture/adrs/`.

## Architecture risks

| Risk                                                         | Mitigation                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| The new `domain/` layer is trivial for a simple CRUD module  | Document that this is the minimal demonstration; complex modules will have richer policies/state machines.                     |
| Stricter DTO rule may force controllers to map DTOs manually | Keep the model type structurally compatible so existing controllers can pass DTOs directly; only the service contract changes. |
