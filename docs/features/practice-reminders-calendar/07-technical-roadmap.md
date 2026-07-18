# Technical roadmap

- Slice A: schema and persistence contracts.
- Slice B: pure reminder, quiet-hours, token, and ICS tests/policies.
- Slice C: protected token create/revoke plus public privacy-safe feed.
- Slice D: notification routes and admin preview/test outbox workflow.
- Slice E: integration/E2E, documentation, and reliability/security review.

Branch strategy: remain on the shared task branch; do not stage, commit, or push this delegated
slice. The root owner packages related changes in bulk after all repository gates are green.

Schema sequence: additive migration first; application tolerates no rows as defaults. Rollback
revokes the routes/code first, then reverts the new tables. No existing column is removed.
