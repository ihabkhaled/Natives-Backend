# Engineering standards check

- Strict TypeScript/ESLint; no `any`, assertions, suppressions, inline layer declarations, or raw
  vendor imports.
- Thin controllers and dedicated DTO/model/policy/repository ownership.
- All SQL parameterized; static identifiers only; lists cap at 100 and order by stable keys/IDs.
- Authn + canonical permission + team/season scope + not-found-on-cross-team.
- UTC instants and date-only period bounds; no timezone conversion in persistence.
- `null` means absent/not evaluated; zero is never rewritten.
- Multi-row writes, audit, and outbox commit in one UnitOfWork transaction.
- Optimistic version checks for mutable state; published/used versions remain immutable.
- Errors are typed, sanitized, and keyed; audit/event payloads contain no PII.
- Tests and docs ship with behavior; touched logic targets at least 95%.

No new permanent repository rule was discovered, so canonical policy files are not changed by
UN-300. Existing focus-rule edits from the parent worktree are preserved.
