# 00 — Intake

- Request ID: `remote-auth-bootstrap`
- Title: Secure local database bootstrap and enriched login response
- Type: security hardening, API contract change, local developer tooling
- Source: user-requested preservation and stabilization of existing dirty work
- Owners: backend engineering; security and QA review required
- Urgency: high because the current draft advertises a predictable admin password
- Affected domains: config, database setup, identity login, RBAC, OpenAPI, tests, operator docs
- Delivery track: one backend-only logical change; no frontend edits in this slice
- Critical risks: credential disclosure, excessive database privilege, breaking login contract
- Scope: preserve explicit local DB/admin bootstrap and the frontend-compatible nested login response while making both architecture-, security-, and test-compliant
