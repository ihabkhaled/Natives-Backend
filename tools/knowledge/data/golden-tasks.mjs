// AUTHORED DATA — not generated. The routing regression suite.
//
// Realistic task phrasings (the way a user actually writes them) with the paths
// the resolver MUST surface (in the warm-up, the curated pack, or the ranked
// results) and the delivery lane the pack MUST classify to. run-benchmark.mjs
// executes these through the real resolver; the Vitest gate fails on any miss.
// Keep every path real — the contradiction-check separately asserts existence.

export const GOLDEN_TASKS = [
  {
    id: 'guard-on-controller',
    task: 'add a guard to a controller to check permissions',
    expectLane: 'critical',
    mustInclude: [
      'rules/07-security-authn-authz.md',
      'skills/add-guard-and-permission.md',
      'agents/backend-security-reviewer.md',
    ],
  },
  {
    id: 'paginated-repo-query',
    task: 'add a paginated repository query',
    expectLane: 'standard',
    mustInclude: [
      'rules/04-repositories-and-persistence.md',
      'rules/08-database-and-injection-safety.md',
      'skills/create-repository.md',
      'agents/database-reviewer.md',
    ],
  },
  {
    id: 'dto-validation',
    task: 'create a new DTO with request validation',
    expectLane: 'standard',
    mustInclude: [
      'rules/05-dto-and-validation.md',
      'skills/create-dto-validation.md',
    ],
  },
  {
    id: 'typed-error',
    task: 'define a new error with a messageKey',
    expectLane: 'standard',
    mustInclude: [
      'rules/18-error-handling-and-exceptions.md',
      'skills/create-error.md',
    ],
  },
  {
    id: 'config-value',
    task: 'add a config value read from env',
    expectLane: 'standard',
    mustInclude: [
      'rules/17-configuration-and-environment.md',
      'skills/add-config-value.md',
    ],
  },
  {
    id: 'wrap-library',
    task: 'wrap an external library behind an adapter',
    expectLane: 'standard',
    mustInclude: [
      'rules/12-library-wrapping-and-adapters.md',
      'skills/add-library-adapter.md',
    ],
  },
  {
    id: 'simplify-clever',
    task: 'simplify this clever code and remove dead branches',
    expectLane: 'fast',
    mustInclude: [
      'rules/21-yagni-and-minimalism.md',
      'skills/simplify-existing-code.md',
    ],
  },
  {
    id: 'write-unit-tests',
    task: 'write unit tests to raise coverage',
    expectLane: 'standard',
    mustInclude: [
      'rules/11-testing-and-coverage.md',
      'skills/write-unit-tests.md',
      'agents/backend-test-engineer.md',
    ],
  },
  {
    id: 'review-readability',
    task: 'review this diff for readability',
    expectLane: 'fast',
    mustInclude: [
      'rules/24-team-readable-code-review.md',
      'skills/review-for-readable-code.md',
    ],
  },
  {
    id: 'scaffold-module',
    task: 'scaffold a new feature module',
    expectLane: 'standard',
    mustInclude: [
      'rules/01-architecture-and-module-boundaries.md',
      'skills/create-module.md',
      'agents/backend-architect.md',
    ],
  },
  {
    id: 'schema-migration',
    task: 'add a schema migration and backfill',
    expectLane: 'critical',
    mustInclude: [
      'rules/08-database-and-injection-safety.md',
      'skills/migration-plan.md',
      'agents/database-reviewer.md',
    ],
  },
  {
    id: 'split-large-service',
    task: 'split an oversized service that is too large',
    expectLane: 'fast',
    mustInclude: [
      'rules/23-function-service-file-size-discipline.md',
      'skills/split-large-service.md',
    ],
  },
];
