# Runbooks

Use this folder for operational procedures that an engineer, SRE, support lead, or incident commander can execute during release, incident response, rollback, recovery, or degraded service situations.

- [safe-diagnostics.md](./safe-diagnostics.md) — **read before collecting any evidence:** what is safe to collect and what must never be recorded (secrets, PII, raw tokens). The meta-runbook every other one defers to.
- [config-validation-and-auth-smoke-test.md](./config-validation-and-auth-smoke-test.md) — startup config, auth, permission, ownership, UUID, and redaction smoke checks.
- [github-required-checks.md](./github-required-checks.md) — safely activate, validate, troubleshoot, rename, or roll back the seven `main` merge checks.
- [incident-response-template.md](./incident-response-template.md) — reusable incident-response + postmortem template.
- [release-smoke-test-template.md](./release-smoke-test-template.md) — reusable release smoke-test template.
- [rollback-template.md](./rollback-template.md) — reusable rollback procedure template.

Deployment-, scaling-, secret-rotation-, and dependency-outage runbooks are deliberately deferred until a real project picks a deployment target — see [`memory/operations-decisions.md`](../memory/operations-decisions.md) for the recorded reasoning.
