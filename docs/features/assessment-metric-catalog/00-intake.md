# UN-300 intake

- Request ID: UN-300
- Title: Assessment metric catalog, categories, scales, periods, and templates
- Type: high-risk backend feature, schema, API, RBAC, and scoring-contract change
- Source: production prompt 300
- Owners: backend assessments owner, product, QA, security, operations
- Severity / urgency: high / prerequisite for assessment, scoring, and measurement work
- Affected domains: assessments, teams, seasons, RBAC, audit, outbox, PostgreSQL, OpenAPI
- Delivery track: standard high-risk track on `feat/ultimate-natives-completion`
- Scope: versioned metric/category/scale dictionary; team/season templates and periods; audited
  seeded defaults; immutable published/used definitions; bounded scoped APIs.
- Critical-risk flags: cross-team IDOR, score semantics, immutable history, migration seed
  determinism, optimistic concurrency, archive-in-use behavior.

