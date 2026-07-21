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

## DTO class names are globally unique

Swagger derives each `components.schemas` key from the DTO **class** name, so two
classes sharing a name collapse into a single entry: the contract then carries
the wrong shape for the loser, every client generated from it is silently wrong,
and NestJS logs `Duplicate DTO detected` (a hard error in its next major).

Every DTO class name is therefore module-qualified and unique across the whole
repository (`TeamTransitionDto` / `MemberTransitionDto`, not two `TransitionDto`s).
Two tests keep it that way:

- `test/openapi-contract.e2e-spec.ts` scans every `*.dto.ts` under `src/modules`
  and fails on any repeated exported class name, and asserts every `$ref` in the
  generated document resolves to a defined schema;
- `src/bootstrap/openapi-schema-names.spec.ts` unit-tests the pure detectors
  (`findDuplicateNames`, `extractExportedClassNames`, `collectSchemaReferences`).

Renaming a DTO class is a **contract change**: regenerate the artifact and tell
the frontend, which regenerates its types from the new schema names.

Review compatibility before accepting a changed checksum. New operations, schemas, and documented
response status codes are additive and can ship first on the backend. Removing or changing an
existing response remains breaking. Deprecations require a migration window. Removed or
structurally changed existing operations/schemas require a coordinated or versioned rollout. CI
blocks them unless the pull request carries the reviewed `api-breaking-approved` label. After
approval, run the frontend `npm run contract:sync`, contract tests, and full gates.

Rollback frontend consumers and its copied artifact first, then restore the previous backend
artifact and implementation.
