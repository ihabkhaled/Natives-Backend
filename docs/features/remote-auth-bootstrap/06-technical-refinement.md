# 06 — Technical Refinement

## Chosen approach

- Keep database existence logic in `src/database`, but call it only from a standalone CLI entrypoint.
- Make ensure failure explicit instead of swallowing it; the setup command owns reporting and exit status.
- Load seed-only configuration directly through a typed config owner so the normal Nest config graph does not require seed credentials.
- Keep seed orchestration in the database operational boundary, with declarations/constants in dedicated database seed owners and only public/shared domain values imported.
- Return a typed `LoginResponse` from identity. Map the internal `UserStatus` to a dedicated client `AccountState`.
- Resolve effective permissions only after credential/session transaction success.

## Alternatives rejected

- Auto-create on every app boot: rejected because it requires excess privilege and hides deployment ordering errors.
- Default seed password: rejected because repository access would grant a predictable credential.
- Put seed password in normal startup validation: rejected because ordinary app boot must not require bootstrap-only secrets.
- Resolve memberships through raw cross-module SQL in identity: rejected because it violates bounded-context ownership.

Debt impact: empty memberships and hard-coded onboarding completion are explicit compatibility placeholders, documented and tested.
