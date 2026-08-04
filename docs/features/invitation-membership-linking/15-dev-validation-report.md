# UN-P0-INV developer validation

Environment: Windows 11, Node 24, disposable PostgreSQL 16 from
`docker-compose.test.yml` on `127.0.0.1:55432`.

## Natives-App

| Check                  | Command                                                                            | Result                                                                                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format                 | `npm run format:check`                                                             | Pass                                                                                                                                                                                          |
| Lint (zero warnings)   | `npm run lint`                                                                     | Pass                                                                                                                                                                                          |
| Typecheck              | `npm run typecheck`                                                                | Pass                                                                                                                                                                                          |
| Unit                   | `npx vitest run --project unit`                                                    | 963 files, 5914 tests pass                                                                                                                                                                    |
| Full quality aggregate | `npm run quality`                                                                  | Pass — 1034 files, 6628 tests; per-file coverage gate green for 1824 files; build, architecture, package-ownership, exports, filenames, locale parity, docs, and agent-entrypoint gates green |
| E2E (desktop)          | `npx playwright test --project=e2e-desktop-en tests/e2e/invite-and-switch.spec.ts` | 8 pass                                                                                                                                                                                        |

## Natives-Backend

| Check                          | Command                                                                                        | Result                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Format                         | `npm run format`                                                                               | Applied, clean                                                                                 |
| Lint                           | `npm run lint`                                                                                 | Pass                                                                                           |
| Typecheck                      | `npm run typecheck`                                                                            | Pass                                                                                           |
| Reconciliation unit spec       | `npx vitest run src/database/seeds/reconcile-invited-memberships.spec.ts`                      | 6 pass                                                                                         |
| Reconciliation PostgreSQL spec | `NODE_ENV=test npx vitest run test/database/reconcile-invited-memberships.integration.spec.ts` | 4 pass, on a container recreated from empty                                                    |
| Full suite + coverage          | `NODE_ENV=test npx vitest run --coverage`                                                      | 843 files, 5436 tests pass. Statements 98.91%, branches 93.36%, functions 99.25%, lines 98.91% |

### One failure investigated and dismissed

An earlier full-suite run reported `test/signup.e2e-spec.ts (8 tests | 1 failed)`.
It was not a regression:

- The spec passes in isolation on a fresh container (8/8).
- `fileParallelism: false`, so no suite runs concurrently with another — the
  reconciliation spec's migration teardown cannot pull the schema out from under
  a neighbour.
- Re-running the whole suite against a container recreated from empty produced
  843/843 files green.

The cause was residual schema state left by an earlier interrupted run, which is
a known property of these suites sharing one database. The rule it confirms:
recreate the container before believing a database-suite failure.

## Falsification evidence

The integration guard was verified to fail without the fix. With the address
removed from the request body, `members-directory-flow.integration.test.tsx`
reported `AssertionError: expected null to be 'recruit@example.com'`. Restoring
the fix returned it to green. A regression test never seen red is not evidence
that it guards anything.

## Not validated here

- Production data. Reconciliation has only been exercised against synthetic
  rows in the disposable container.
- Deployed smoke tests, GitHub checks, and Vercel deployment: nothing was
  pushed, so none of these ran. See `22-go-no-go.md`.
- iOS compilation: unavailable off macOS. Unverified, not assumed.
