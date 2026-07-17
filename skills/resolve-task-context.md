# Skill: Resolve Task Context (the mandatory first step)

> Before reading anything else for a task, run the compiled resolver: it returns the fixed warm-up set, a **curated pack** of the exact rules/skills/reviewers/validation for the task, and a keyword-ranked shortlist of the exact source and docs to open. Read that, then act — you skip re-reading the ~370K-token corpus. Implements the fast-context-routing discipline of [/context/architecture-map.md](../context/architecture-map.md) and the orientation sequence in [/memory/ai-context-map.md](../memory/ai-context-map.md); the tooling lives in [/tools/knowledge](../tools/knowledge/README.md).

This is the **first** step of every task, ahead of any other skill. It does not replace reading the exact source and tests — it tells you _which_ to read. When the resolver returns nothing useful (a task type it does not know yet), fall back to [/memory/ai-context-map.md](../memory/ai-context-map.md) and [/context/codebase-navigation.md](../context/codebase-navigation.md) by hand, and consider adding the task type to [`tools/knowledge/data/routing-map.mjs`](../tools/knowledge/data/routing-map.mjs).

---

## Rules this skill enforces

- **Resolver first, corpus never wholesale.** Load `.ai/BOOTSTRAP.md` and the resolver output, not the whole rulebook, to orient. The corpus is routed to, not read front-to-back ([/tools/knowledge/README.md](../tools/knowledge/README.md)).
- **Read the exact source and tests before editing either** — the resolver names them; you still open them ([00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md), rule 42; [final-validation.md](./final-validation.md)).
- **Honor the curated pack's lane.** A `critical`-lane pack (auth, permissions, injection, destructive schema) pulls in the security/database reviewer and `security:scan`; do not drop to a lighter lane ([15-review-checklist.md](../rules/15-review-checklist.md)).
- **The pack points; the rules decide.** If the pack and a rule disagree, the rule wins — the pack is compiled from the task-router table, not a new authority ([/memory/ai-context-map.md](../memory/ai-context-map.md), rules/22).

---

## Step 1 — Read the cold-start bootstrap

Open [`.ai/BOOTSTRAP.md`](../.ai/BOOTSTRAP.md) once (~450 tokens): project purpose, authority precedence, the non-negotiable rule categories, and the quality gates. It is the fastest full-context load.

## Step 2 — Run the resolver for your exact task

```bash
npm run knowledge:context -- --task="add a paginated repository query"
# or, when you already know the files / have a diff:
npm run knowledge:context -- --files="src/modules/articles/infrastructure/article.repository.ts"
npm run knowledge:context -- --diff="main...HEAD"
```

It writes `.ai/local/current-context.md` (human) and `.json` (machine). If it errors that manifests are missing, run `npm run knowledge:build` first.

## Step 3 — Read the output top to bottom

- **Warm-up** — the five files every task reads (`claude.md`, `rules/00`, `architecture-map`, `stack-and-toolchain`, `known-pitfalls`).
- **Curated pack** — the guaranteed bundle for this task type: the lane, the rules to read, the skills to follow, the reviewer(s) to invoke, and the exact validation commands. Open every rule and skill it lists.
- **Ranked context** — the keyword-ranked source files and docs; open the top entries that are in scope.
- **Touched modules** — the module cards for anything your change lands in.

## Step 4 — Open the exact source and tests

From the ranked list and touched modules, open the owning code **and its colocated `*.spec.ts`** before editing either. The resolver identifies them; reading them is still on you.

## Step 5 — Hand off to the task's skill

The pack names the authoring/refactor skill for the work (e.g. [create-repository.md](./create-repository.md), [add-guard-and-permission.md](./add-guard-and-permission.md)). Follow it, then run the pack's validation commands and [final-validation.md](./final-validation.md) before declaring done.

---

## Quality gates

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
```

Never bypass Husky with `--no-verify`. (These gate your change, not the resolver run; the resolver only reads.)

## Pitfalls

- **Skipping the resolver and grep-ing the whole corpus.** That is the minutes-of-wandering this tool removes ⇒ run it first, every task.
- **Reading the pack's rules but not opening the source/tests.** The pack routes; it does not prove current behavior ⇒ read the exact code before planning ([00](../rules/00-non-negotiable-rules.md) rule 42).
- **Treating a stale `.ai/local/current-context.md` as fresh.** It is per-run output ⇒ re-run the resolver for each new task; never edit it by hand (it is gitignored).
- **Ignoring a `critical` lane because the diff looks small.** Auth/permission/schema changes stay critical regardless of size ⇒ invoke the named reviewer and run `security:scan`.
- **A task type the resolver does not know.** It returns warm-up + ranked only, no pack ⇒ route by hand via [/memory/ai-context-map.md](../memory/ai-context-map.md) and add the task type to [`routing-map.mjs`](../tools/knowledge/data/routing-map.mjs) so the next agent gets a pack.
- **Editing the manifests or BOOTSTRAP by hand.** They are generated ⇒ change the generator and run `npm run knowledge:build` ([/tools/knowledge/README.md](../tools/knowledge/README.md)).

## Related

[final-validation.md](./final-validation.md) · [reuse-before-creating.md](./reuse-before-creating.md) · [write-simple-readable-code.md](./write-simple-readable-code.md) · [../tools/knowledge/README.md](../tools/knowledge/README.md) · [../.ai/README.md](../.ai/README.md) · [../memory/ai-context-map.md](../memory/ai-context-map.md) · [../context/codebase-navigation.md](../context/codebase-navigation.md) · [README.md](./README.md)
