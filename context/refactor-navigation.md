# Refactor Navigation

Start with [rules/28](../rules/28-codebase-refactor-discipline.md) and the current request artifacts.

- Inline/anonymous declaration → [refactor-inline-declarations](../skills/refactor-inline-declarations.md)
- Constants/types/interfaces/enums → [extract-constants-types-enums](../skills/extract-constants-types-enums.md)
- Repeated/complex pure logic → [extract-helper-safely](../skills/extract-helper-safely.md)
- Overbuilt code → [simplify-existing-code](../skills/simplify-existing-code.md)
- Clever chains/types → [refactor-smart-code-to-boring-code](../skills/refactor-smart-code-to-boring-code.md)
- Dead/speculative surface → [remove-unnecessary-code](../skills/remove-unnecessary-code.md)
- Large service/use case/repository/adapter/guard/pipe → matching `split-large-*` skill
- Auth/permissions/ownership/secrets → [security clean-code map](./security-clean-code-map.md)
- DTO/config/pipe validation → [validation clean-code map](./validation-clean-code-map.md)
- Repository-wide pass → [full-codebase-cleanup](../skills/full-codebase-cleanup.md)
- Mirrors/entrypoints → [agent-readiness map](./agent-readiness-map.md)

For every route: read controller → application → domain/lib → repository → adapter → tests. Pin behavior, move one responsibility, update wiring/exports/docs, delete the old owner, run the focused test, then continue.
