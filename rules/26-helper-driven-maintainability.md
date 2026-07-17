# 26 — Helper-Driven Maintainability

> A helper is a single tested owner for meaningful repeated logic—not a hiding place for side effects or a one-line indirection. This rule refines [23 §4](./23-function-service-file-size-discipline.md).

## Create or extend a helper when

- the same meaningful logic has two-to-three real call sites;
- a multi-clause business/security decision needs one testable name;
- mapping, formatting, bounds, allowlists, payload construction, or error normalization obscures orchestration;
- a layer budget requires extraction to the concern's real owner.

Security, permission, ownership, validation, and error-mapping helpers may extract at one use because centralized testing is a current safety reason.

## Ownership

- Business decision/invariant → `domain/*.policy.ts`.
- Mapping/formatting/pure transformation → module `lib/`.
- Query shaping/allowlists → `infrastructure/` helper plus `model/*.constants.ts`.
- Cross-module dependency-light behavior → `shared/`.
- Cross-cutting infrastructure behavior → `core/` or `config/`.

Search the existing owner first. Extend it; never create a parallel helper with a synonym.

## Every helper must

Have one verb-based name, typed input/output, one responsibility, purity where practical, no hidden I/O, no vendor import, no cycle, tests when it owns behavior, and the narrowest necessary export surface.

## Do not extract

One obvious line, a single simple comparison, a wrapper whose call is less clear than its body, a helper that accepts a repository/SDK to disguise a layer violation, or a generic `utils.ts` dumping ground.

## Review checklist

- [ ] Extraction removes duplication or clarifies ownership.
- [ ] Existing owner search completed.
- [ ] Side effects remain visible in services/use cases/adapters.
- [ ] Meaningful branches and bounds have tests.
- [ ] No safety check or message key disappeared during extraction.

**Related:** [22-reuse-before-creating.md](./22-reuse-before-creating.md) · [23-function-service-file-size-discipline.md](./23-function-service-file-size-discipline.md) · [30-declaration-ownership.md](./30-declaration-ownership.md) · [../skills/extract-helper-safely.md](../skills/extract-helper-safely.md)
