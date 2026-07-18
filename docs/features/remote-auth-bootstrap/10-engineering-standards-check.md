# 10 — Engineering Standards Check

| Standard     | Constraint                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Layering     | No runtime DB provisioning; cross-module imports use public surfaces/ports.                                    |
| Declarations | DTOs in `api/dto`, model contracts/enums in `model`, database setup/seed declarations in database-owned files. |
| Security     | Runtime-only admin password, no credential logging, parameterized values, validated database identifier.       |
| Persistence  | Seed transaction is leak-safe and rerunnable; no `synchronize`; migrations remain authoritative.               |
| Config       | Seed-only env is typed/validated by its dedicated loader; example and docs stay synchronized.                  |
| API          | Controller remains one delegation; OpenAPI describes the exact nested response.                                |
| Testing      | Tests-first regression coverage on all changed behavior and failure paths.                                     |
| Readability  | Direct, focused helpers; no speculative framework or deep-import shortcuts.                                    |

Permanent-rule update: not required. Existing rules already prohibit committed secrets, excess startup privilege, inline declarations, and undocumented breaking contracts.
