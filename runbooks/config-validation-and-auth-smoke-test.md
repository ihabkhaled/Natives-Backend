# Config Validation and Auth Smoke Test

## Prerequisites

- Reviewed build from this request.
- Non-production environment.
- `.env` based on `.env.example`; never record the real JWT secret in evidence.
- For deterministic user B / no-role token cases, run `npm run test -- test/app.e2e-spec.ts`; that harness signs isolated test tokens through the app-owned token port and closes the app afterward.

## Startup validation

1. Run `npm run build`.
2. Start with valid config; confirm health returns 200.
3. In a disposable test process, set `PORT=0`; confirm startup fails with `Invalid environment configuration`.
4. In a disposable production-mode process, omit/use a placeholder `JWT_SECRET`; confirm startup fails.
5. Restore valid config before continuing.

## Auth/permission/ownership smoke

1. Login with the reference non-production user; expect 200 and an access token.
2. Call article list without a token; expect 401 + `errors.auth.tokenRequired`.
3. Submit wrong credentials; expect 401 + `errors.auth.invalidCredentials`.
4. Automated harness: use its no-role token; expect 403 + `errors.auth.permissionDenied`.
5. Automated harness: create as user A, read/list as user B; expect 404 and an empty list/zero total.
6. Call an article id with malformed UUID; expect 400 + `errors.validation.invalidUuid`.
7. Inspect logs: authorization/password/secret values must be absent or `[Redacted]`.

## Abort and rollback

Abort on unexpected success for invalid config, cross-owner visibility, leaked token/password, wrong status/key, or any 5xx. Revert the runtime/security slice and restore the prior config template; no data rollback is required.
