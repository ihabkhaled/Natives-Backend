# Skill: Prepare Agent Mirrors

## Intent

Keep every supported agent entrypoint aligned with canonical IronNest policy without multiplying full policy bodies.

## When to use

Use when permanent rules, rule numbers/links, required read order, quality gates, or supported agent entrypoints change.

## When not to use

Do not create another full mirror when an existing bootstrap/mirror already fulfills the tool family. Do not place implementation policy only in an agent-specific file.

## Steps

1. Read `claude.md`, [rules/29](../rules/29-agent-readiness-and-mirrors.md), all current entrypoints, and their documented precedence.
2. Update `claude.md` first for permanent policy; update rules/context/skills owners next.
3. Classify each surface: full mirror, bootstrap, active Cursor rule, legacy shim, or compact family entrypoint.
4. Add only the compact ladder, safety boundary, and links required for that surface.
5. Ensure links cover `claude.md`, rules README/00/20/22/28/30, skills README/full cleanup, architecture map, and known pitfalls.
6. Update full mirrors only to match canonical text; do not invent model-specific exceptions.
7. Check names, counts, links, thresholds, and precedence across every entrypoint.

## Checklist

- [ ] `claude.md` is canonical and changed first.
- [ ] Rules remain policy; skills remain procedures.
- [ ] No unnecessary full duplicate was created.
- [ ] Every supported entrypoint has current compact links and the minimum-safe ladder.
- [ ] Broken links, stale counts, and conflicting thresholds are zero.

## Related rules and skills

[rules/29](../rules/29-agent-readiness-and-mirrors.md) · [rules/27](../rules/27-no-token-burning-code.md) · [context/agent-readiness-map.md](../context/agent-readiness-map.md) · [full-codebase-cleanup.md](./full-codebase-cleanup.md)

## Quality gates

`npm run format:check` · `npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:coverage` · `npm run build`, plus a relative-link and consistency review.
