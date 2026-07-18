# 07 — Technical Roadmap

- Milestone A: safety baseline — remove committed password and runtime database creation.
- Milestone B: explicit setup — `db:ensure` → migrations → admin seed.
- Milestone C: contract — nested login tokens/user, account-state mapping, resolved permissions.
- Milestone D: evidence — unit/integration/E2E updates and full gates.

Branch/merge: one logical backend change; no file-by-file commits. This delegated slice will not commit or push.

Schema evolution: none. Existing migrations and tables are reused.

Compatibility: login is breaking and must be deployed with the matching frontend. Refresh and invitation acceptance remain flat session responses.

Rollback order: client/server contract together, then setup scripts/docs if required. No automatic data rollback is performed.
