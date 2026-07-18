# UN-900 intake

- Request ID: UN-900
- Title: Canonical OpenAPI contract and generated frontend client
- Type: cross-repository contract and build-tooling change
- Source: production prompt 900 and the 2026-07-18 completion audit
- Owners: backend contract owner, frontend HTTP owner, QA, security, release owner
- Severity / urgency: critical / immediate because current remote-mode routes and payloads drift
- Affected domains: every HTTP API, auth, practices, dashboard, CI, documentation
- Delivery track: critical, coordinated frontend/backend branch
- Scope: deterministic backend OpenAPI artifact and checksum, generated frontend types, drift gates,
  and migration of active frontend gateways to backend-owned paths.
