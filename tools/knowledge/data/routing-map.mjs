// AUTHORED DATA — not generated. Hand-maintained; the resolver consumes it.
//
// The executable form of the "Route by task -> rule + skill" and
// "Route by goal -> reviewer agent" tables in memory/ai-context-map.md. When a
// task string matches an entry's keywords, resolve-context.mjs emits that
// entry's curated pack (rules + skills + reviewers + lane + validation) as a
// GUARANTEED bundle, distinct from the keyword-ranked results. This compiles an
// existing authored table into code rather than inventing a parallel router
// (rules/22) — keep it in sync with that table when either changes.
//
// A YAML file was considered (per the external spec) but rejected: the shipped
// knowledge tooling is deliberately dependency-free (no YAML parser installed),
// and config-as-`.mjs` is the repo's established convention (eslint/*.config.mjs).

const BASE_VALIDATION = [
  'npm run lint',
  'npm run typecheck',
  'npm run test:coverage',
  'npm run build',
];
const SECURITY_VALIDATION = [...BASE_VALIDATION, 'npm run security:scan'];

const REVIEWERS = {
  architect: 'agents/backend-architect.md',
  codeReviewer: 'agents/backend-code-reviewer.md',
  security: 'agents/backend-security-reviewer.md',
  database: 'agents/database-reviewer.md',
  performance: 'agents/backend-performance-reviewer.md',
  reliability: 'agents/reliability-engineer.md',
  observability: 'agents/observability-reviewer.md',
  test: 'agents/backend-test-engineer.md',
};

// Lane scales artifact WEIGHT, never phase existence (claude.md delivery lanes).
// critical = auth/permissions/injection/destructive-schema; standard = normal
// feature/config/persistence work; fast = readability/cleanup/no-contract-change.
export const ROUTING_MAP = [
  {
    id: 'scaffold-module',
    title: 'Scaffold a feature module',
    keywords: ['scaffold', 'new module', 'new feature', 'create module'],
    lane: 'standard',
    rules: ['rules/01-architecture-and-module-boundaries.md'],
    skills: ['skills/create-module.md'],
    reviewers: [REVIEWERS.architect],
    validation: BASE_VALIDATION,
  },
  {
    id: 'add-controller',
    title: 'Add/edit a controller',
    keywords: ['controller', 'endpoint', 'route', 'http'],
    lane: 'standard',
    rules: ['rules/02-controllers-and-http-transport.md'],
    skills: ['skills/create-controller.md'],
    reviewers: [REVIEWERS.codeReviewer],
    validation: BASE_VALIDATION,
  },
  {
    id: 'add-use-case',
    title: 'Add multi-step / transactional orchestration',
    keywords: ['use case', 'use-case', 'transaction', 'orchestration'],
    lane: 'standard',
    rules: ['rules/03-application-services-and-use-cases.md'],
    skills: ['skills/create-use-case.md'],
    reviewers: [REVIEWERS.architect],
    validation: BASE_VALIDATION,
  },
  {
    id: 'add-service',
    title: 'Add a focused capability (service)',
    // Deliberately NOT the bare token "service": it would fire on
    // "split/review the service" and over-escalate those fast-lane tasks.
    keywords: [
      'new service',
      'add a service',
      'focused capability',
      'capability',
    ],
    lane: 'standard',
    rules: ['rules/03-application-services-and-use-cases.md'],
    skills: ['skills/create-service.md'],
    reviewers: [REVIEWERS.codeReviewer],
    validation: BASE_VALIDATION,
  },
  {
    id: 'touch-persistence',
    title: 'Touch persistence / add a query',
    keywords: ['repository', 'persistence', 'query', 'paginate', 'paginated'],
    lane: 'standard',
    rules: [
      'rules/04-repositories-and-persistence.md',
      'rules/08-database-and-injection-safety.md',
    ],
    skills: ['skills/create-repository.md'],
    reviewers: [REVIEWERS.database],
    validation: BASE_VALIDATION,
  },
  {
    id: 'add-dto',
    title: 'Add / validate a DTO',
    keywords: ['dto', 'validation', 'validate', 'request body', 'payload'],
    lane: 'standard',
    rules: ['rules/05-dto-and-validation.md'],
    skills: ['skills/create-dto-validation.md'],
    reviewers: [REVIEWERS.codeReviewer],
    validation: BASE_VALIDATION,
  },
  {
    id: 'declarations',
    title: 'Add / move a type, interface, enum, or constant',
    keywords: ['type', 'interface', 'enum', 'constant', 'declaration'],
    lane: 'fast',
    rules: [
      'rules/30-declaration-ownership.md',
      'rules/06-types-enums-constants.md',
    ],
    skills: [
      'skills/extract-constants-types-enums.md',
      'skills/refactor-inline-declarations.md',
    ],
    reviewers: [REVIEWERS.codeReviewer],
    validation: BASE_VALIDATION,
  },
  {
    id: 'guard-permission',
    title: 'Add a guard / permission',
    keywords: [
      'guard',
      'permission',
      'authorize',
      'authorization',
      'rbac',
      'ownership',
    ],
    lane: 'critical',
    rules: ['rules/07-security-authn-authz.md'],
    skills: ['skills/add-guard-and-permission.md'],
    reviewers: [REVIEWERS.security],
    validation: SECURITY_VALIDATION,
  },
  {
    id: 'wrap-library',
    title: 'Wrap an external library',
    keywords: ['adapter', 'wrap', 'library', 'vendor', 'sdk', 'integration'],
    lane: 'standard',
    rules: ['rules/12-library-wrapping-and-adapters.md'],
    skills: ['skills/add-library-adapter.md'],
    reviewers: [REVIEWERS.architect],
    validation: BASE_VALIDATION,
  },
  {
    id: 'event-or-job',
    title: 'Emit / handle an event or job',
    keywords: ['event', 'job', 'queue', 'handler', 'notification'],
    lane: 'standard',
    rules: ['rules/19-async-events-and-jobs.md'],
    skills: ['skills/add-event-handler.md'],
    reviewers: [REVIEWERS.reliability],
    validation: BASE_VALIDATION,
  },
  {
    id: 'config-value',
    title: 'Add a config value',
    keywords: ['config', 'env', 'environment', 'setting'],
    lane: 'standard',
    rules: ['rules/17-configuration-and-environment.md'],
    skills: ['skills/add-config-value.md'],
    reviewers: [REVIEWERS.codeReviewer],
    validation: BASE_VALIDATION,
  },
  {
    id: 'define-error',
    title: 'Define / raise an error',
    keywords: ['error', 'exception', 'apperror', 'messagekey'],
    lane: 'standard',
    rules: ['rules/18-error-handling-and-exceptions.md'],
    skills: ['skills/create-error.md'],
    reviewers: [REVIEWERS.codeReviewer],
    validation: BASE_VALIDATION,
  },
  {
    id: 'i18n-key',
    title: 'Add a message key / locale string',
    keywords: ['message key', 'locale', 'i18n', 'translation'],
    lane: 'standard',
    rules: ['rules/16-i18n-and-messaging.md'],
    skills: ['skills/add-i18n-message-key.md'],
    reviewers: [REVIEWERS.codeReviewer],
    validation: BASE_VALIDATION,
  },
  {
    id: 'schema-migration',
    title: 'Schema change / backfill',
    keywords: ['schema', 'migration', 'backfill', 'alter table'],
    lane: 'critical',
    rules: ['rules/08-database-and-injection-safety.md'],
    skills: ['skills/migration-plan.md', 'skills/add-migration-backfill.md'],
    reviewers: [REVIEWERS.database],
    validation: SECURITY_VALIDATION,
  },
  {
    id: 'simplify',
    title: 'Simplify overbuilt / clever / dead code',
    keywords: [
      'simplify',
      'clever',
      'dead code',
      'overbuilt',
      'boring',
      'refactor',
    ],
    lane: 'fast',
    rules: [
      'rules/21-yagni-and-minimalism.md',
      'rules/20-simple-readable-code.md',
    ],
    skills: [
      'skills/simplify-existing-code.md',
      'skills/refactor-smart-code-to-boring-code.md',
      'skills/remove-unnecessary-code.md',
    ],
    reviewers: [REVIEWERS.codeReviewer],
    validation: BASE_VALIDATION,
  },
  {
    id: 'reuse-before-create',
    title: 'Add any new file / helper / constant',
    keywords: ['new file', 'new helper', 'reuse', 'where does', 'owner'],
    lane: 'fast',
    rules: ['rules/22-reuse-before-creating.md'],
    skills: ['skills/reuse-before-creating.md'],
    reviewers: [REVIEWERS.codeReviewer],
    validation: BASE_VALIDATION,
  },
  {
    id: 'split-large',
    title: 'Split an oversized service / use case / repository',
    keywords: ['split', 'oversized', 'too large', 'god file', 'decompose'],
    lane: 'fast',
    rules: ['rules/23-function-service-file-size-discipline.md'],
    skills: [
      'skills/split-large-service.md',
      'skills/split-large-use-case.md',
      'skills/split-large-repository.md',
    ],
    reviewers: [REVIEWERS.architect],
    validation: BASE_VALIDATION,
  },
  {
    id: 'review-readability',
    title: 'Review a diff for readability',
    keywords: ['review', 'readable', 'readability', 'audit'],
    lane: 'fast',
    rules: [
      'rules/24-team-readable-code-review.md',
      'rules/15-review-checklist.md',
    ],
    skills: ['skills/review-for-readable-code.md'],
    reviewers: [REVIEWERS.codeReviewer],
    validation: BASE_VALIDATION,
  },
  {
    id: 'repo-cleanup',
    title: 'Run a repository-wide cleanup',
    keywords: ['cleanup', 'repository-wide', 'sweep', 'codebase refactor'],
    lane: 'standard',
    rules: [
      'rules/28-codebase-refactor-discipline.md',
      'rules/30-declaration-ownership.md',
    ],
    skills: ['skills/full-codebase-cleanup.md'],
    reviewers: [REVIEWERS.architect],
    validation: BASE_VALIDATION,
  },
  {
    id: 'refactor-security-validation',
    title: 'Refactor security / validation without weakening',
    keywords: ['refactor security', 'refactor validation', 'without weakening'],
    lane: 'critical',
    rules: [
      'rules/07-security-authn-authz.md',
      'rules/05-dto-and-validation.md',
    ],
    skills: [
      'skills/cleanup-security-code-without-weakening.md',
      'skills/cleanup-validation-code-without-weakening.md',
    ],
    reviewers: [REVIEWERS.security],
    validation: SECURITY_VALIDATION,
  },
  {
    id: 'agent-mirrors',
    title: 'Update agent entrypoints / mirrors',
    keywords: ['mirror', 'entrypoint', 'bootstrap', 'agents.md', 'claude.md'],
    lane: 'standard',
    rules: ['rules/29-agent-readiness-and-mirrors.md'],
    skills: ['skills/prepare-agent-mirrors.md'],
    reviewers: [REVIEWERS.codeReviewer],
    validation: BASE_VALIDATION,
  },
  {
    id: 'write-tests',
    title: 'Write tests / raise coverage',
    keywords: ['test', 'tests', 'coverage', 'spec'],
    lane: 'standard',
    rules: ['rules/11-testing-and-coverage.md'],
    skills: [
      'skills/write-unit-tests.md',
      'skills/write-integration-tests.md',
      'skills/write-e2e-tests.md',
    ],
    reviewers: [REVIEWERS.test],
    validation: BASE_VALIDATION,
  },
];
