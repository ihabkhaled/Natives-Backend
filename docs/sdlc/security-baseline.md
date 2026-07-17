# Security Baseline

## Purpose

This document defines the minimum security and privacy bar for any shipped change.

## Baseline Requirements

### Identity, Auth, and Access

- Use approved authentication mechanisms only.
- Enforce authorization server-side.
- Review role, scope, tenant, and privilege boundaries for every changed path.
- Test both permitted and denied actions.

### Secrets and Configuration

- Store secrets in approved secret-management systems.
- Do not hardcode credentials.
- Do not log secrets or expose them to clients.
- Rotate sensitive credentials when risk or architecture change justifies it.

### Input, Output, and Abuse Resistance

- Validate input on trust boundaries.
- Encode or sanitize output according to rendering context.
- Review injection, XSS, CSRF, SSRF, IDOR, path traversal, deserialization, open redirect, and business-logic abuse risk.
- Define rate limits or abuse controls for externally reachable workflows.

### Data Protection

- Classify data handled by the change.
- Minimize data collection and storage.
- Define retention, masking, and deletion expectations.
- Protect data in transit and at rest according to company policy and regulatory needs.

### Logging and Auditability

- Security-relevant actions must be auditable.
- Logs must support investigation without leaking protected data.
- High-risk workflows should preserve actor, target, timestamp, result, and correlation identifiers.

### Dependencies and Supply Chain

- Review new dependencies before adoption.
- Scan dependencies and containers according to company tooling.
- Protect CI/CD with access control, integrity checks, and traceable builds.

### Infrastructure and Deployment

- Harden exposed services.
- Review network access, ports, trust boundaries, and ingress rules.
- Validate rollback safety and secret handling during release.

## Security Evidence Expectations

Security review should leave evidence of:

- what was reviewed
- which threat scenarios were considered
- what findings were raised
- what was fixed
- what remains open
- who accepted any residual risk

## Threat Modeling Trigger Conditions

Threat modeling is mandatory when a change touches:

- auth or permissions
- money flow
- external integrations
- tenant isolation
- PII or sensitive data
- file upload or file download
- admin workflows
- infrastructure access
- AI model invocation with sensitive data
- customer-visible workflows with abuse potential

## Validation Methods

Depending on risk, validation may include:

- secure design review
- auth and permission testing
- abuse-case walkthroughs
- dependency scanning
- secret and config review
- logging and data-leakage review
- dynamic security testing
- penetration-style testing

## Exit Rule

No unresolved critical or high security issue may ship without an explicit written waiver from authorized leadership.

## Common Security Failure Modes To Watch

- assuming authorization because authentication exists
- leaking secrets or protected data through logs
- trusting client-supplied state
- weak tenant-boundary checks
- introducing operational access paths with no audit trail
- changing deployment behavior without reviewing exposure and rollback safety
