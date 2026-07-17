# Skill: Clean Up Security Code Without Weakening It

## Intent

Make authentication, authorization, ownership, secrets, and security-error code simpler while preserving or strengthening every control.

## When to use

Use when refactoring guards, token/password adapters, permission catalogs, ownership policies, rate limits, security config, or sensitive logging.

## When not to use

Do not combine security controls for fewer files, delete a defense-in-depth check as duplicate, or change security behavior without threat/test evidence.

## Steps

1. Trace the full protected flow and read security decisions/tests: trusted token → auth guard → permission guard → owner/tenant scope → application/repository.
2. Write negative tests first for missing/invalid identity, malformed payload, denied permission, cross-owner access, and secret/log leakage.
3. Move vendor crypto/token calls behind app-owned ports/adapters; runtime-validate decoded data.
4. Centralize roles, permissions, metadata keys, and owner policies in their existing owners; remove raw strings and duplicates.
5. Keep queries owner/tenant-scoped before count/pagination and retain application-layer defense.
6. Map known failures to typed `AppError`/message keys; keep responses sanitized and logs redacted.
7. Validate all security config at startup, with stricter production secret checks.
8. Re-run focused security/e2e tests and inspect logs before full gates.

## Checklist

- [ ] Identity comes only from a verified, runtime-validated token.
- [ ] Auth, permissions, and ownership remain distinct, ordered, and fail closed.
- [ ] No vendor security library leaks outside its owner.
- [ ] Cross-owner/tenant existence and counts do not leak.
- [ ] Secrets/passwords/tokens never enter responses or logs.
- [ ] Security tests and docs changed with behavior.

## Related rules and skills

[rules/07](../rules/07-security-authn-authz.md) · [rules/12](../rules/12-library-wrapping-and-adapters.md) · [rules/17](../rules/17-configuration-and-environment.md) · [security-review.md](./security-review.md) · [split-large-guard-or-pipe.md](./split-large-guard-or-pipe.md)

## Quality gates

`npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:coverage` · `npm run build` · `npm run security:scan`.
