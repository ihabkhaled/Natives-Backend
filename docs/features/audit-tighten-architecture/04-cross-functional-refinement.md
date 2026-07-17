# 04 — Cross-Functional Refinement

## Participants

| Function      | Representative                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture  | Senior backend architect / AI agent                                                                                                                   |
| Engineering   | Same delivery agent                                                                                                                                   |
| QA            | Automated test suite                                                                                                                                  |
| Security      | Security rules documented in `rules/07-security-authn-authz.md` and `docs/sdlc/security-baseline.md` (no new runtime security surface in this scope). |
| DevOps        | Existing CI scripts in `package.json` (no pipeline changes in this scope).                                                                            |
| Documentation | Same delivery agent                                                                                                                                   |
| Support       | Not applicable for this internal refactor.                                                                                                            |

## Findings by function

### Engineering

- The custom ESLint plugin only has two rules; the governance docs describe many more expectations.
- The reference app service imports API DTOs and generates entity metadata inline.
- No ESLint rule tests exist.

### QA

- Existing tests cover happy paths and basic error paths.
- New rule tests are required for any added ESLint rule.
- Coverage thresholds are already met; touched modules must stay at or above thresholds.

### Security

- No new security-sensitive code is added.
- Existing security rules (no `process.env` outside config, no secret leakage, sanitized errors) remain in force and are tightened by the audit.

### Documentation

- Several governance docs describe the same concepts with slightly different wording.
- New AI-agent entrypoints are missing.

## Hidden work

- Formatting the entire governance tree (152 files) is a one-time cleanup that must happen before meaningful diffs are readable.
- Converting ESLint rule tests into the Vitest harness requires enabling test globals or writing manual Linter tests.

## Integration points

- ESLint rules are configured in `eslint.config.mjs` and `eslint/architecture.config.mjs`.
- Vitest configuration must include new rule tests if they are placed under `test/`.
- Path aliases in `tsconfig.json` and `vitest.config.mts` must remain aligned.

## Missing requirements

None identified. The request is intentionally bounded to audit and tightening.

## Open questions

| Question                                               | Answer                                                                                                 | Owner     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | --------- |
| Should ESLint rules be converted from `.mjs` to `.ts`? | No in this scope. Keep `.mjs` to avoid breaking ESLint flat-config imports, and add `.mjs` rule tests. | Architect |
| Should the in-memory repository be replaced?           | No. The scope is architecture discipline, not persistence engine.                                      | Architect |
| Should auth guards be wired?                           | No. The architecture patterns are documented; wiring them is a future feature.                         | Architect |

## Decisions

1. Keep the existing folder structure and architecture map.
2. Add small, focused ESLint rules rather than a massive single rule.
3. Demonstrate the stricter rules in the reference app before declaring the work done.
4. Add AI-agent entrypoints for the five requested model families.
