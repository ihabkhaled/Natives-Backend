# Safe Diagnostics

> The meta-runbook every other runbook defers to for _how to collect evidence without creating a second incident_. Read this before gathering diagnostics during any incident, outage, or degraded-service situation. It encodes the security and privacy invariants ([`rules/07`](../rules/07-security-authn-authz.md), [`memory/security-decisions.md`](../memory/security-decisions.md), [`memory/privacy-decisions.md`](../memory/privacy-decisions.md), [`memory/observability-decisions.md`](../memory/observability-decisions.md)) as an operational procedure.

## When to use

Any time you are about to run a diagnostic command, copy a log, capture a request, or attach evidence to a ticket, postmortem, or support thread — during config/auth troubleshooting, an outage, a rollback, a security/privacy incident, or a performance investigation.

## The one rule

**Collecting evidence must never leak a secret or personal datum, and must never mutate production state.** A diagnostic that exposes a credential or corrupts data has turned an incident into two. When in doubt, collect less and escalate.

## Safe to collect

- Structured application logs **by request/correlation id** (the logger already redacts `authorization`, passwords, and configured secret/PII fields — [`memory/observability-decisions.md`](../memory/observability-decisions.md)).
- HTTP status codes, `messageKey`s, timing/latency, error class names, stack traces from _server-side_ logs (never from a client response).
- Health/readiness output, process metrics (CPU, memory, event-loop lag), dependency reachability (up/down, latency).
- The exact build/commit id, the environment name, and the config **keys** present (not their values).
- Reproduction steps and inputs that contain no real personal data (use synthetic fixtures — [`testing/test-data-and-fixtures.md`](../testing/test-data-and-fixtures.md)).
- Read-only queries against a **disposable** or non-production copy.

## Never collect / never record

- Secrets or credentials of any kind: `JWT_SECRET`, tokens, passwords, API keys, connection strings, private keys. Never paste `.env` values, and never echo `process.env` into a ticket.
- Personal data beyond what the incident strictly requires — and never in a shared/searchable location. This repo processes only auth credentials ([`memory/privacy-decisions.md`](../memory/privacy-decisions.md)); a real project extends this list from its data inventory.
- Raw `Authorization` headers, cookies, or session tokens (log by request id instead; the redaction pipeline exists precisely so you never handle the raw value).
- Full request/response bodies containing user data — capture the shape and the `messageKey`, not the payload.
- Anything that requires _writing_ to production to observe (no "just toggle it and see"; use a disposable process — see the config runbook's `PORT=0` / production-mode pattern).

## Procedure

1. **State the question first.** Name the one thing you are trying to learn. Diagnostics without a hypothesis over-collect.
2. **Prefer read-only, non-production surfaces.** Reproduce against a disposable process or a non-production environment before touching anything live ([config-validation-and-auth-smoke-test.md](./config-validation-and-auth-smoke-test.md)).
3. **Collect by reference, not by value.** Request/correlation ids over raw payloads; config keys over config values; log lines over live memory dumps.
4. **Redact before it leaves the process boundary.** Rely on the logger's redaction for anything logged; for anything hand-copied, redact secrets/PII yourself _before_ it enters a ticket, chat, or report.
5. **Store evidence in the incident record, minimally.** Attach only what answers the question, to the incident/postmortem artifact ([incident-response-template.md](./incident-response-template.md), [`docs/features/_template/27-postmortem.md`](../docs/features/_template/27-postmortem.md)) — not to open chat.
6. **If you might have exposed a secret, treat it as a security incident.** Rotate/revoke and escalate per [`memory/security-decisions.md`](../memory/security-decisions.md); do not "clean up the message later."

## Escalation

- Suspected or actual secret/credential exposure, or PII in a shared location → escalate as a **security/privacy incident** immediately (rotate the exposed secret; preserve the incident record).
- Any diagnostic that would require mutating production to answer → stop and escalate for a change-controlled approach instead.

## Related

- [incident-response-template.md](./incident-response-template.md) · [config-validation-and-auth-smoke-test.md](./config-validation-and-auth-smoke-test.md) · [rollback-template.md](./rollback-template.md)
- [`memory/security-decisions.md`](../memory/security-decisions.md) · [`memory/privacy-decisions.md`](../memory/privacy-decisions.md) · [`memory/observability-decisions.md`](../memory/observability-decisions.md) · [`rules/14-observability-and-logging.md`](../rules/14-observability-and-logging.md)
