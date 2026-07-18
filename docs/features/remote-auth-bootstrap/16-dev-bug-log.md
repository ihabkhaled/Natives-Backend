# 16 — Developer Bug Log

## Resolved defects

1. **Normal startup attempted database creation**
   - Risk: the runtime principal needed excess `CREATE DATABASE` privilege.
   - Resolution: moved database creation to the explicit `db:ensure` /
     `db:setup` operator path.

2. **Bootstrap credential had a predictable repository value**
   - Risk: an unchanged local default could reach a shared environment.
   - Resolution: removed the password fallback and made the seed fail fast
     unless a runtime password of at least 12 characters and at most 72 UTF-8
     bytes is supplied.

3. **Administrator seed mixed CLI, config, SQL, and reporting**
   - Risk: untestable behavior and unclear declaration ownership.
   - Resolution: separated seed config, transactional seed logic, types,
     constants, and the CLI adapter.

4. **Login response omitted the frontend principal contract**
   - Symptom: login returned only session tokens.
   - Resolution: preserved the nested token object and added the mapped user,
     account state, effective permissions, onboarding state, and memberships.

5. **Manual setup contaminated the shared disposable test database**
   - Symptom: migration-subset tests observed migrations applied by the manual
     operator-flow validation.
   - Resolution: recreated only the explicitly named Compose test database and
     reran coverage from a clean state.

## Open defects

None in this implementation slice. Cross-repository compatibility remains part
of the parent task's final E2E validation.
