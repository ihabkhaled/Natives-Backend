# 07 — Technical Roadmap

## Implementation sequence

1. Add `.nvmrc`; align package engines and scripts.
2. Repair Dependabot.
3. Add lint, typecheck, unit, E2E, coverage, build, and security workflows.
4. Document workflow/check ownership and branch-protection steps.
5. Add release/support context.
6. Run unit/E2E scripts independently, then all existing gates.

## Branch strategy

Work remains uncommitted on `main` for owner review. No branch, commit, push, or GitHub setting mutation is performed.

## Compatibility

No API/schema/runtime behavior change. Contributor/runner runtime moves from an inaccurate `>=20` claim to the current Node `24.18.0` LTS pin. Typecheck and production build move to TypeScript 7.0.2’s native CLI while API-dependent tooling uses the official compatibility package.

## Rollback order

Remove branch-protection requirements if later configured, revert workflows/Dependabot, then revert scripts/runtime pin/docs.
