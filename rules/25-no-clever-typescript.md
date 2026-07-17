# 25 — No Clever TypeScript

> TypeScript exists to make behavior easier to trust, not to demonstrate type-system tricks. This rule specializes the judgment bar in [20 §4](./20-simple-readable-code.md); all hard type-safety rules in [00](./00-non-negotiable-rules.md) and [13](./13-eslint-and-typescript.md) still apply.

## Required

- Prefer a named `interface` and explicit return type over inferred, conditional, or mapped-type acrobatics.
- Narrow `unknown` with small readable guards; never replace narrowing with cast chains.
- Keep generics concrete and shallow. A generic with one use and no boundary reason is speculative.
- Name intermediate values when one expression performs multiple transformations.
- Use enum members and owned contracts; do not hide domain meaning behind broad `Record<string, unknown>` shapes.
- Apply the 30-second rule: if a mid-level backend engineer cannot understand the type in 30 seconds, simplify it or record why the complexity is unavoidable.

## Forbidden

Nested conditional types, recursive type puzzles, unexplained overload sets, cast pipelines, one-use generic frameworks, inferred anonymous public contracts, and clever one-liners that require a comment to decode.

## Safety boundary

Simplifying a type must not widen trusted boundaries, remove runtime validation, weaken exhaustiveness, or turn a vendor shape into an application contract. Validation and adapter normalization remain explicit.

## Review checklist

- [ ] Public contracts are named and owned in `model/`, `shared/`, `core/`, or DTO files.
- [ ] No `any`, non-null/definite-assignment assertion, suppression, or unnecessary cast.
- [ ] Generics and overloads have multiple real consumers or a documented boundary reason.
- [ ] Runtime input is still validated before a narrower type is trusted.
- [ ] A junior can follow the value flow and a senior can trust the contract.

**Related:** [20-simple-readable-code.md](./20-simple-readable-code.md) · [21-yagni-and-minimalism.md](./21-yagni-and-minimalism.md) · [30-declaration-ownership.md](./30-declaration-ownership.md) · [../skills/refactor-smart-code-to-boring-code.md](../skills/refactor-smart-code-to-boring-code.md)
