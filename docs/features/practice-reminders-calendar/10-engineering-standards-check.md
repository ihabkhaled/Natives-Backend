# Engineering standards check

Applicable rules: strict TypeScript/ESLint, no inline layer declarations, thin controllers, focused
services, use-case transaction ownership, parameterized/bounded repositories, typed errors,
validated DTOs, auth + permission + ownership checks, UTC persistence, adapter isolation,
fail-safe/deduplicated outbox delivery, structured non-PII logs, tests and docs together.

Simple Code Ladder:

1. Reuse current practice sessions, membership probes, clock/id ports, outbox, notification inbox,
   preferences, retry/dead-letter worker, validation/OpenAPI wrappers.
2. Use native `crypto` and `Intl`, isolated behind owned code.
3. Add only the missing feed, quiet-hours, and reminder policy owners.

Permanent-rule update: not applicable; no new repository-wide standard is introduced.

Implementation constraints: no package/bootstrap/OpenAPI ownership edits in this slice; no raw token
storage or logging; every query parameterized and each result window bounded.
