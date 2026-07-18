# Technical roadmap

- Branch: reuse `feat/ultimate-natives-completion`; preserve all shared dirty work; no staging,
  commit, or push in this slice.
- Expand: additive `1722300000000` migration and idempotent global seeds. Old application ignores
  the new tables; new application requires the migration.
- Application: domain policies, persistence, transactions, audit/outbox, then HTTP transport.
- Contract: backend OpenAPI generation is owned by the parent integration stream and is not edited
  in this parallel slice.
- Rollback: stop assessment-catalog traffic, revert application, then run migration `down`; because
  the tables are new, down removes only this feature's data. Export/backup team custom catalog data
  before down in any environment where users have written it.
- A later contract migration is unnecessary; no old column is renamed or removed.

