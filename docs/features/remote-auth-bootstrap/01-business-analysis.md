# 01 — Business Analysis

## Problem and desired state

Local operators need a repeatable way to create the application database, apply migrations, and provision an administrator. The login consumer also needs permissions and profile state in the initial response. The current draft couples database creation to every app boot and publishes a usable seed password.

The desired state is an explicit, idempotent setup workflow with a runtime-only administrator password, plus one documented login response contract that the web/mobile client can consume immediately.

## Stakeholders and outcomes

- Developers: one discoverable setup command and deterministic reruns.
- Operators/security: no startup `CREATEDB` requirement and no committed admin credential.
- Web/mobile client: nested tokens and enriched user data in one response.
- QA/support: stable contract examples and reproducible validation.

Success means setup is explicit, rerunnable, fails loudly, and normal startup only needs application-database privileges; successful login returns the documented nested shape; all touched tests and gates pass.

Assumptions: the local admin email/display name may use synthetic defaults; the password must always be provided at runtime. Membership enrichment is not yet owned by identity, so the contract returns an empty array.

Dependencies: PostgreSQL, applied RBAC migration data, bcrypt adapter, effective-permission resolver.

Risk of inaction: leaked/predictable credentials, avoidable production privilege, failed frontend login hydration, and untested contract drift.
