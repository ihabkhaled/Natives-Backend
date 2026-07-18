# Implementation readiness

- Branches: `feat/ultimate-natives-completion` in both repositories.
- Slices and owners: defined in `07-technical-roadmap.md`.
- Config: generation uses validated existing config and synthetic/local database settings; no new
  secret is introduced.
- Migration/backfill: not applicable; no persisted schema changes.
- Rollback: revert consumers, restore prior artifact/checksum, then revert backend generator.
- Observability: schema-mismatch and affected endpoint failures remain sanitized and correlated.
- Review: architecture, API, QA, security, and release owners required.
- Known gap: host Node/npm is below the backend release toolchain; final release evidence requires
  Node 24.18.0 and npm 11.16.0 or newer compatible versions.

The dirty auth/bootstrap slice must be green before active contract generation is accepted.
