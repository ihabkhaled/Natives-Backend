# Delivery plan

1. Stabilize the current login/bootstrap dirty slice.
2. Extract deterministic OpenAPI document generation and commit backend artifact/checksum.
3. Add backend stale/determinism/contract tests and scripts.
4. Generate frontend contract types through one owned tooling surface.
5. Align active auth and practice gateways with backend paths and team context.
6. Add real-backend synthetic integration and Playwright evidence.
7. Run critical-lane gates independently in both repositories.

Rollback is repository-local: revert generated consumers first, then backend generation tooling;
retain the previous contract artifact until the client rollback window closes.
