# Auth, Permission, and Ownership Regression

## Purpose

Prove the protected article flow fails closed and does not leak another owner's resource or count.

## Preconditions

- Test app booted with valid non-production config.
- Run `npm run test -- test/app.e2e-spec.ts src/modules/auth/adapters/jwt-token.adapter.spec.ts src/core/auth/auth-identity.validator.spec.ts`. E2E setup creates isolated user B/no-role token C; the focused adapter/validator specs cover a verified but malformed claim payload.

## Cases

1. Missing bearer token → 401 `errors.auth.tokenRequired`.
2. Malformed/invalid token → 401 `errors.auth.invalidToken`.
3. Token with malformed identity claims → 401 `errors.auth.invalidToken`.
4. Token C on article list → 403 `errors.auth.permissionDenied`.
5. User A creates article → 201; owner id equals user A.
6. User B reads user A article id → 404 `errors.article.notFound`.
7. User B list excludes user A article and its total.
8. Malformed UUID → 400 `errors.validation.invalidUuid`.
9. Logs contain request correlation and message key but no token/password/secret.

## Evidence

Record environment/build, request/status/messageKey, returned owner-scoped total, and redaction check. Preserve failing and retest evidence if a defect is found.

## Cleanup

Close the in-memory test app. No durable state remains.
