# Canonical OpenAPI contract

Generate the backend-owned artifact:

```bash
npm run contract:generate
```

Verify that committed bytes and checksum match current controllers/DTOs without writing:

```bash
npm run contract:check
```

The artifact contains no runtime data, credentials, examples with personal data, or access tokens.
Operation IDs are stable `<ControllerWithoutSuffix>.<method>` values. Protected operations inherit
the JWT security requirement; `@Public()` operations publish the anonymous alternative.

Review compatibility before accepting a changed checksum. New operations, schemas, and documented
response status codes are additive and can ship first on the backend. Removing or changing an
existing response remains breaking. Deprecations require a migration window. Removed or
structurally changed existing operations/schemas require a coordinated or versioned rollout. CI
blocks them unless the pull request carries the reviewed `api-breaking-approved` label. After
approval, run the frontend `npm run contract:sync`, contract tests, and full gates.

Rollback frontend consumers and its copied artifact first, then restore the previous backend
artifact and implementation.
