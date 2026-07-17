# No Token-Burning Code

Human attention, AI context, review time, CI time, and runtime resources are finite.

## Remove

Duplicated policy text, parallel helpers, unused env/config, speculative DTOs/providers, one-use generic frameworks, repeated mocks, broad snapshots, generated boilerplate, comments that restate code, and huge mixed diffs.

## Keep explicit

Validation, auth, permissions, ownership, error mapping, query scope/bounds, adapter failures, transactions, terminal states, observability, tests, and rollback. Hiding these to save lines is unsafe, not efficient.

## Practical rules

- Compact routers link to canonical rules. Only the explicitly approved `codex.md` and `cursor.md` full mirrors duplicate policy, and they must stay byte-identical.
- Name intermediate transformations instead of compressing chains.
- Reuse one fixture/helper only after meaningful repetition.
- Delete the complete dead surface: code, provider/export, config/env, test, and docs.
- Split diffs by responsibility and files by a current reason to change.

Canonical rule: [rules/27-no-token-burning-code.md](../rules/27-no-token-burning-code.md).
