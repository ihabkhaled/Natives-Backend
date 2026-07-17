# Skill: Full Codebase Cleanup

## Intent

Apply the Simple Readable Code Operating System across an existing repository as a controlled sequence of responsibility-based, tested refactors.

## When to use

Use for repository-wide inline-declaration, duplication, vendor-boundary, size, config, error, security, validation, and documentation cleanup.

## When not to use

Do not use for one isolated finding; choose the focused skill. Do not turn cleanup into an architecture rewrite, dependency upgrade, or unrelated feature.

## Steps

1. Complete SDLC phases 00–13; read policy, architecture, source, tests, tooling, and current request artifacts.
2. Record clean baseline commands and audit by owner: governance → static enforcement → controllers/application/domain/persistence/adapters → core/shared/config/bootstrap → tests/docs.
3. Prioritize safety findings: auth, permissions, ownership, validation, error leakage, secrets/config, query bounds, vendor boundaries.
4. Add characterization/regression tests before each behavior-affecting slice.
5. Move declarations with [refactor-inline-declarations.md](./refactor-inline-declarations.md); remove duplicates/dead surfaces completely.
6. Split only at current responsibility seams using the focused split skills.
7. Run focused tests after every slice; stop and fix the root cause of any regression.
8. Run readable-code, security, observability, and no-weakening reviews.
9. Run every repository gate and complete validation/defect/security/docs/readiness evidence.

## Checklist

- [ ] Audit and phases 00–13 exist before implementation.
- [ ] Every finding has one owner and risk classification.
- [ ] No random refactor, half migration, duplicate owner, or speculative abstraction.
- [ ] Security/validation/auth/authorization/ownership/observability/tests/docs stayed or improved.
- [ ] Source, static enforcement, examples, indexes, mirrors, and artifacts agree.
- [ ] Remaining gaps are explicit; no false readiness claim.

## Related rules and skills

[rules/20](../rules/20-simple-readable-code.md) · [rules/28](../rules/28-codebase-refactor-discipline.md) · [rules/30](../rules/30-declaration-ownership.md) · [simplify-existing-code.md](./simplify-existing-code.md) · [review-for-readable-code.md](./review-for-readable-code.md) · [final-validation.md](./final-validation.md)

## Quality gates

`npm run format:check` · `npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:coverage` · `npm run build` · `npm run security:scan` · `npm run deps:check` when available.
