# UN-P0-INV coverage plan

## Touched modules and thresholds

| Module                                                                  | Threshold                         | Result                                                                                                       |
| ----------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Natives-App` members module (types, gateway, service, hook, helper)    | 95% per file                      | Green — `test:coverage:per-file` passed for 1824 files                                                       |
| `Natives-App` ui-workbench routes                                       | 95% per file, 100% for pure logic | Green — both branches of the production gate covered                                                         |
| `Natives-Backend` `src/database/seeds/reconcile-invited-memberships.ts` | 95% lines/functions/statements    | Covered by the unit spec (all branches: pending, accepted, ambiguous, missing role) plus the PostgreSQL spec |

## Critical scenario areas

These are covered by scenario, not merely by line execution:

- The two-address equality invariant, at three layers.
- The ambiguity refusal, at two layers.
- The role-key-missing failure.
- The dry-run no-write guarantee.

## Measurement

Frontend: `npm run test:coverage` and `npm run test:coverage:per-file`, both
inside `npm run quality`. Backend: `npm run test:coverage`.

## Waivers

None requested.
