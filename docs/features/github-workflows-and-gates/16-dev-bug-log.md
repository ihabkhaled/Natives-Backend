# 16 — Developer Bug Log

## Resolved defects

1. **Direct TypeScript 7 broke Nest CLI build**
   - Symptom: `getParsedCommandLineOfConfigFile is not a function`.
   - Root cause: TypeScript 7.0 does not ship the compiler API consumed by Nest CLI and lint tools.
   - Resolution: Microsoft’s official side-by-side package layout; TypeScript 7 owns CLI typecheck/build and `@typescript/typescript6` supplies only the API.

2. **Manual peer-range edits produced false install confidence**
   - Symptom: npm resolution appeared valid while lint crashed in SonarJS.
   - Root cause: changing lockfile metadata cannot restore removed runtime APIs.
   - Resolution: regenerated the lockfile from published metadata; no `legacy-peer-deps`, force flag, or manual peer edit remains.

3. **ESLint rule tests relied on transitive hoisting**
   - Symptom: eight suites could not resolve `@typescript-eslint/parser`.
   - Root cause: tests directly imported an undeclared package.
   - Resolution: added the parser as a direct dev dependency and upgraded typescript-eslint.

4. **Coverage workflow was duplicated during editing**
   - Symptom: duplicate top-level YAML document content.
   - Resolution: reduced the file to one workflow definition and included it in formatting/static review.

## Stability decision

No open implementation defect remains subject to final all-gates rerun and first GitHub-hosted execution.
