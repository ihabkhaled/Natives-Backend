# Support Guidance: Simple Readable Code Implementation

## Expected behavior

- Valid login: 200 with `accessToken`.
- Missing token: 401, `errors.auth.tokenRequired`.
- Invalid credentials: 401, `errors.auth.invalidCredentials`.
- Missing permission: 403, `errors.auth.permissionDenied`.
- Malformed article UUID: 400, `errors.validation.invalidUuid`.
- Missing or other-owner article: 404, `errors.article.notFound`.

## Startup failures

The service requires `NODE_ENV` and a sufficiently long `JWT_SECRET` in every environment; production also rejects placeholders and low-entropy values. Compare runtime values to `.env.example`; never paste secrets into tickets or logs.

## Triage

1. Confirm build/commit and environment.
2. Reproduce with the runbook smoke test.
3. Inspect structured logs by request id; authorization headers/passwords are redacted.
4. For 403, verify server-owned role→permission mapping, not client-supplied permissions.
5. For owner-scoped 404, confirm the token user id owns the resource; do not disclose another owner's existence.

Escalate unexpected 5xx, startup rejection with valid config, redaction failure, or cross-owner visibility as a security-impacting defect.
