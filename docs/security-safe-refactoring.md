# Security-Safe Refactoring

Security cleanup must preserve distinct controls:

`verified token → authentication → permission authorization → owner/tenant scope → application defense → bounded persistence`

## Procedure

1. Pin missing/invalid token, malformed identity, denied permission, cross-owner/tenant, and leakage behavior with tests.
2. Put JWT/password/crypto vendors behind app-owned ports/adapters.
3. Runtime-validate decoded payloads before attaching identity.
4. Keep roles/permissions/metadata keys in one server-owned catalog.
5. Scope persistence before ordering/count/pagination; do not reveal out-of-scope existence.
6. Map expected failures to typed `AppError` message keys.
7. Preserve redaction and validate security config at startup, stricter in production.
8. Inspect route-level behavior and logs after unit tests.

Never merge auth and permission guards merely to save a file, trust permissions from client input, move vendor calls into helpers, remove defense-in-depth as duplicate, log credentials/tokens, or weaken a negative assertion.

Use [skills/cleanup-security-code-without-weakening.md](../skills/cleanup-security-code-without-weakening.md) and [rules/07](../rules/07-security-authn-authz.md).
