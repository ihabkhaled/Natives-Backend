# 03 — Product Requirements

## Epic

Make IronNest's Simple Readable Code Operating System executable, discoverable, and demonstrated by the actual backend.

## User stories

1. As an engineer or AI agent, I can locate the existing owner before creating a declaration or abstraction.
2. As a reviewer, I can verify that every layer is short, explicit, and free of inline contracts/config maps.
3. As a security reviewer, I can trace authentication, permissions, and ownership from trusted token to bounded persistence.
4. As an operator, I get a startup failure for invalid consumed configuration instead of silent fallback.
5. As a maintainer, I can replace JWT/bcrypt vendors at their adapters without editing application logic.

## Acceptance criteria

- Existing simplicity rules are extended without conflicting numbering or duplicate canon.
- Requested skills have explicit intent, use/not-use guidance, numbered procedure, checklist, related material, and gates.
- Declaration, cleanup, agent-readiness, security-safe, and validation-safe guidance is indexed.
- Every layer file uses imported declaration owners; DTO fields contain no definite-assignment `!`.
- JWT and bcrypt imports are confined to approved adapter/module owners and mechanically checked.
- Auth failures use typed `AppError` + `errors.auth.*` keys.
- Protected article routes require central permissions; identity comes from the verified token.
- Article id/list persistence is owner-scoped before result/total calculation and remains bounded.
- Every consumed environment value is typed and validated; unused example variables are removed.
- Static-rule changes have tests.
- No tests are removed or weakened; all available gates pass.

## In scope

Governance/mirrors, static enforcement, auth/users/articles, DTOs, config/bootstrap integration, shared enums/constants/types, tests, reference patterns, and request evidence.

## Out of scope and non-goals

Database/schema changes, refresh-token/session implementation, production deployment, new customer workflows, dependency upgrades, or generic frameworks for future modules.

## UX, errors, permissions, analytics, localization

- UX: API behavior only; errors stay sanitized and machine-readable.
- Error states: invalid/missing token and invalid credentials receive an auth-specific 401 key; missing permission receives an auth-specific 403 key; out-of-owner resources return not-found without existence leakage.
- Permissions: central `Permission` enum and role-to-permission map; no raw role/permission comparisons.
- Analytics: not applicable; accepted by repository architect because no product analytics surface exists.
- Localization: message keys remain stable machine contracts; no locale resource system exists in the reference app.

## Product definition of done

Code, tests, static enforcement, documentation, mirrors, and phase evidence agree, with no security or quality gate weakened.
