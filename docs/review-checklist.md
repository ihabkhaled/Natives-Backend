# Readable Code Review Checklist

Use the canonical [pre-merge checklist](../rules/15-review-checklist.md) and [nineteen questions](../rules/24-team-readable-code-review.md). This compact pass is for review speed.

- Can a junior follow the flow without author context?
- Can a senior trust the validation, auth, permission, ownership, error, adapter, transaction, and query boundaries?
- Is each controller one delegation and each service/use case/repository/adapter in its lane?
- Does every declaration have one owner, with no anonymous public/request/result/config shape?
- Are types understandable in 30 seconds and helpers justified by ownership/reuse/testability?
- Are vendors isolated, config fail-fast validated, and logs redacted?
- Are owner/tenant filters applied before count/pagination?
- Are errors typed, keyed, and sanitized?
- Do tests state scenarios, cover negative/boundary/security paths, and avoid implementation-detail snapshots?
- Were docs, examples, memory/context, and agent pointers updated without copying policy bodies?
- Is the next change easy?
- Are all gates actually green?

Severity: safety, architecture, tests, docs, or hard-rule gaps are **MUST FIX**. Readability debt is **SHOULD FIX**. Follow-up requires an owner and date.
