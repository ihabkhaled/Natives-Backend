# 06 — Technical Refinement

## Technical context

- NestJS 11 with Fastify platform adapter.
- ESLint 9 flat config with a custom architecture plugin in `eslint/architecture-plugin/`.
- TypeScript 6 with strict flags, `typescript-eslint` type-checked rules.
- Vitest for unit/integration/e2e tests, v8 coverage.
- In-memory repository for the reference app.
- Path aliases: `@/*`, `@app/*`, `@config/*`, `@core/*`, `@modules/*`, `@shared/*`.

## Alternatives considered

| Approach                                            | Pros                              | Cons                                                                                | Decision                                                                 |
| --------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Convert ESLint plugin to TypeScript                 | Type safety, coverage integration | Requires build step or loader changes for ESLint config; breaks flat-config imports | Rejected for this scope. Keep `.mjs`.                                    |
| Add many broad ESLint rules at once                 | Fast coverage of rulebook         | High false-positive risk; hard to review                                            | Rejected. Add focused rules one at a time with fixtures.                 |
| Rewrite reference app as a complex domain           | Better demonstrates use cases     | Over-engineering for a simple CRUD reference                                        | Rejected. Add a small `domain/` factory only.                            |
| Rename folders to match stricter conventions        | Cleaner names                     | Large diff, breaks existing links, no functional value                              | Rejected. Keep existing structure.                                       |
| Use Node built-in test runner for ESLint rule tests | Simple for `.mjs` rules           | Separate from `npm run test`                                                        | Rejected. Integrate into Vitest with `RuleTester` for unified reporting. |

## Chosen approach

1. Keep the ESLint plugin as `.mjs` but test it with Vitest using `RuleTester` (requires `globals: true` in Vitest).
2. Add focused rules:
   - `architecture/no-inline-layer-declarations` — module-level declarations in implementation layers.
   - `architecture/no-dto-import-in-application-layer` — services/use cases should not import API DTOs.
   - `architecture/no-use-case-import-in-service` — explicit check for service → use-case imports.
3. Update the reference app to demonstrate the rules:
   - Add `src/modules/articles/domain/article.factory.ts` to own entity creation.
   - Change `ArticlesService.create` to accept `CreateArticleData` and delegate to factory + repository.
   - Change `ArticleRepository` to `save(article: Article)`.
   - Extract remaining magic numbers into `article.constants.ts`.
4. Align governance docs and add AI-agent entrypoints.

## Rejected approaches

See table above.

## Open technical questions

| Question                                       | Status                                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Should `RuleTester` require Vitest globals?    | Accepted; enable `globals: true` in `vitest.config.mts`.                                        |
| Should the service return a DTO or an entity?  | Keep returning DTO via mapper; the controller remains one delegation.                           |
| Should UUID/time generation be a core adapter? | Not for this scope; use a domain factory. Future integrations can add a `ClockPort`/`UuidPort`. |
