# Technical roadmap

- Branch: `feat/ultimate-natives-completion` independently in both repositories.
- Slice A: backend document factory, normalizer, artifact/checksum, check command, tests, docs.
- Slice B: frontend generated contract owner and checksum check.
- Slice C: auth compatibility and real-backend tests.
- Slice D: practice team-scope compatibility and real-backend tests.
- Slice E: CI/release evidence and prompt-ledger update.

No schema migration is required. Breaking contract changes use expand/contract or coordinated
frontend/backend commits with an explicit rollback order.
