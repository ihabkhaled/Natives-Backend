# 09 — Impact Analysis

## Affected systems

- `src/modules/articles` — small refactor to demonstrate stricter layering.
- `eslint/architecture-plugin/` — new rules and shared helpers.
- `eslint/architecture.config.mjs` — new rule wiring and override configs.
- `test/eslint/` — new rule test files.
- Governance docs — alignment updates and new AI-agent entrypoints.
- `vitest.config.mts` — enable test globals for `RuleTester`.
- `package.json` — may add a script or dependency if needed (none planned).

## Affected teams

- Internal architecture / platform team.
- Future AI-assisted contributors reading the entrypoint files.

## Backward compatibility

- HTTP API contract remains unchanged.
- Internal TypeScript signatures change only in the `articles` module, which is a reference app.
- ESLint rules are additive; existing compliant code is unaffected.

## Migration needs

- None for production data (in-memory store).
- Future modules that copied the old service-imports-DTO pattern will need to migrate to model types. This is documented as a follow-up.

## Monitoring impact

None. No new runtime observability is added.

## Support impact

- New AI-agent entrypoints reduce onboarding questions.
- Stricter rules reduce the need for manual layer reviews.

## Training impact

- Contributors must read the updated `context/architecture-map.md` and the new agent entrypoints.
- The reference app is the primary training material.

## Compliance impact

None. The change reinforces existing security and quality rules without introducing new regulated data handling.

## Privacy impact

None.

## Required checklist updates

- `claude.md` and mirror files must be updated if a new permanent rule is discovered.
- `AGENTS.md` must list the new entrypoint files.
