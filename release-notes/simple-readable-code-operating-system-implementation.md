# Draft — Simple Readable Code Operating System Implementation

## Summary

When approved and released, IronNest will apply its readable-code policy to the runnable backend, not only governance.

## Runtime-visible changes

- Login success explicitly returns HTTP 200.
- Missing/invalid auth, invalid credentials, permission denial, and invalid UUID failures return specific sanitized message keys.
- Article routes use central permissions.
- Article reads/lists are owner-scoped before count and pagination; out-of-owner ids return not-found.
- JWT and bcrypt calls are isolated behind app-owned adapters.
- `NODE_ENV` and a minimum-length JWT secret are required everywhere; production requires generated-looking secret material.
- Stale environment example keys were removed.

## Engineering changes

Rules 25–30, new cleanup/declaration/agent-readiness skills and maps, tested ESLint checks for anonymous layer contracts and definite-assignment assertions, conservative layer method budgets, and JWT/bcrypt package ownership.

## Compatibility and rollout

No schema or migration. Invalid config that previously fell back may stop startup, and clients should consume message keys rather than internal text. Run the [config/auth smoke test](../runbooks/config-validation-and-auth-smoke-test.md).

## Rollback

Revert runtime/tests, static rules/tests, and governance/docs as coherent slices. No persisted data rollback is needed.
