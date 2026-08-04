# UN-P0-INV defect cycle log

No defects were returned from an independent QA cycle, because no independent
QA cycle ran — validation was the automated suites plus the falsification check
described in `15-dev-validation-report.md`.

The development-cycle defects are logged in `16-dev-bug-log.md`. All seven were
found by the repository's own gates (lint, typecheck, and the PostgreSQL spec)
before any commit, retested, and closed. None changed the behaviour of the
shipped repair; they changed how it is expressed and how it is tested.

Behaviour changes made while resolving them:

- The MSW invitation handlers and the shared actor/URL helpers moved to new
  files. No handler behaviour changed; `membersHandlers` composes the same set.
- The reconciliation unit spec now mocks by statement rather than by call order,
  which makes it insensitive to adding or moving an audit write.
