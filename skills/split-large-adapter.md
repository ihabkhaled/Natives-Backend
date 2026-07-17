# Skill: Split a Large Adapter

## Intent

Restore one external capability per adapter while keeping vendor details contained and app-owned contracts stable.

## When to use

Use when an adapter wraps several vendor capabilities, mixes payload mapping/config/retry/business policy, leaks vendor types, or has methods that no longer scan as one external operation.

## When not to use

Do not split a small cohesive adapter by line count. Do not move vendor calls into `lib/` or services; that only relocates the boundary violation.

## Steps

1. Read adapter callers, port/types/constants, module wiring, docs, and tests; add characterization tests first for mapping/errors/timeouts.
2. Identify current capability seams and search for existing adapter/helper owners.
3. Keep or define the smallest app-owned port; vendor types never cross it.
4. Move pure payload/result mapping to the adapter's `lib/`/mapper owner and constants/config to dedicated owners.
5. Split only independent vendor capabilities into separate adapters; keep one adapter when methods share one client/policy.
6. Preserve typed error mapping, timeouts, bounded retries, redacted logging, and normalized results.
7. Update provider bindings, exports, package-boundary policy, adapter docs, and mocks.
8. Run adapter specs and consumer specs before the full gates.

## Checklist

- [ ] Only approved adapter/module wiring imports the vendor.
- [ ] Port is app-owned, small, and vendor-free.
- [ ] No business rule or hidden side effect moved into the adapter.
- [ ] Error/timeout/retry/redaction behavior remains tested.
- [ ] Split follows a current capability seam, not a line target.

## Related rules and skills

[rules/12](../rules/12-library-wrapping-and-adapters.md) · [rules/23](../rules/23-function-service-file-size-discipline.md) · [rules/28](../rules/28-codebase-refactor-discipline.md) · [add-library-adapter.md](./add-library-adapter.md) · [extract-helper-safely.md](./extract-helper-safely.md)

## Quality gates

`npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:coverage` · `npm run build` · `npm run security:scan`.
