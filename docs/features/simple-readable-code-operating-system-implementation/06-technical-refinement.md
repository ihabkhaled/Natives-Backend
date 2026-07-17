# 06 — Technical Refinement

## Technical context

The repository already has rules 20–24, a custom architecture plugin, strict TypeScript, and a small Fastify reference app. This request extends that owner set and removes live-code exceptions rather than creating a parallel operating system.

## Alternatives considered

### Governance

- Create requested rule files using their original numbers: rejected because 21–24 already have canonical owners.
- Extend rules 20–24 and add 25–30 for uncovered concerns: chosen.
- Copy full policy into every agent file: rejected as drift/token-burning; compact links are chosen.

### Authentication and vendors

- Keep direct `JwtService`/bcrypt imports and document exceptions: rejected; contradicts adapter policy.
- Wrap JWT and password verification behind app-owned ports with module-local adapters: chosen.
- Add a generic crypto framework: rejected as speculative.

### Authorization and ownership

- Keep raw role strings/`RolesGuard`: rejected; policy requires central permissions.
- Add `Permission`/`Role` enums, one role-permission map, and a permission guard: chosen.
- Filter article ownership after repository pagination: rejected because it leaks totals and produces sparse pages.
- Scope persistence by owner before pagination and retain application-layer trust checks: chosen.

### Static enforcement

- Ban all string literals/magic numbers: rejected due high false-positive risk.
- Extend the existing inline-declaration rule to nested type literals, ban definite-assignment assertions, add conservative per-layer method budgets, and enforce JWT/bcrypt import ownership: chosen if tests prove activation.

### Config

- Preserve fallback parsing for malformed values: rejected; violates fail-fast validation.
- Validate every consumed key, require strong JWT secrets in production, and remove unused examples: chosen.

## Trade-offs

More explicit owner files and ports add navigation, but each is justified by a security/vendor/layer boundary and removes direct coupling. Security behavior becomes stricter: cross-owner reads do not reveal existence, and malformed config stops startup.

## Open technical questions

None blocking. Static detection of business logic in repositories, bounded queries, and general magic strings remains partly review-based and will be documented rather than approximated unsafely.

## Debt impact

Reduces vendor coupling, role/permission duplication risk, ownership leakage, config drift, inline contract debt, stale examples, and mirror ambiguity.
