# Simple Readable Code

The best backend code is the code the next developer understands immediately.

Use the canonical [Simple Code Ladder](../rules/20-simple-readable-code.md):

1. Does it need to exist?
2. Does IronNest already own it?
3. Does Node.js, TypeScript, NestJS, or the platform solve it?
4. Does an approved dependency solve it through an existing adapter?
5. Can a small pure helper own it?
6. Can it be written directly and clearly?
7. Only then create an abstraction for a current boundary or repeated use.

Minimal means minimum **safe** code. DTO validation, typed errors/message keys, authentication, permissions, ownership, query bounds, adapters, config validation, redaction, tests, docs, observability, and terminal async states stay.

## Before and after

```ts
// Before: anonymous contract, raw status, mapping hidden in orchestration.
async function load(id: string): Promise<{ id: string; state: string }> {
  const item = await repository.findById(id);
  return { id: item.id, state: item.status === 'published' ? 'live' : 'draft' };
}
```

```ts
// After: owned contracts, enum values, named mapper.
async function load(id: string): Promise<ArticleSummary> {
  const article = await repository.findById(id);
  return toArticleSummary(article);
}
```

The mapper belongs in the module `lib/`; `ArticleSummary` belongs in `model/*.types.ts`; status belongs to the module/shared enum. Do not extract an obvious one-line comparison unless ownership, reuse, testability, or a layer budget requires it.

## Review bar

- Junior-readable: flow is obvious top to bottom.
- Senior-trustworthy: validation, guards, ownership, errors, adapters, bounds, and state transitions are visible and test-backed.
- AI-ready: owners and public surfaces are discoverable; no duplicate or token-burning scaffolding.

Practical routes: [declaration ownership](./declaration-ownership.md), [cleanup playbook](./codebase-cleanup-playbook.md), [maintainability](./maintainability-guide.md), and [review](./review-checklist.md). Rules remain canonical.
