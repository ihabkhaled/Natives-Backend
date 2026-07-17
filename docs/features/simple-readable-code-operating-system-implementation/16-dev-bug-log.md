# 16 — Developer Bug Log

## Defects found and resolved

1. Inline-type lint initially double-reported a named type alias.
   - Severity: medium static-rule correctness.
   - Fix: skip nested type literals already owned by a named interface/type declaration.
   - Retest: focused RuleTester suite passes.
2. Adapter specs inherited production-layer inline-declaration caps.
   - Severity: medium developer experience.
   - Fix: apply test overrides after architecture overrides while retaining strict no-any/no-assertion rules.
   - Retest: resolved-config activation test added and passes.
3. Computed environment/permission/error map access triggered injection lint.
   - Severity: medium static/security clarity.
   - Fix: keep env literals at the config edge and use typed `ReadonlyMap` lookups for role/error catalogs.
   - Retest: lint, typecheck, config/permission/error tests pass.
4. Framework 4xx errors used the internal-server message/key.
   - Severity: high error-contract correctness.
   - Fix: safe status-specific HTTP message-key map; known auth/UUID paths use typed `AppError`s.
   - Retest: mapper and e2e tests pass.
5. Login documented 200 but inherited POST 201.
   - Severity: medium API contract.
   - Fix: explicit `HttpStatus.OK`; e2e regression added.
6. Initial touched config/error coverage exposed missing invalid-boolean/framework-500 cases.
   - Severity: medium test completeness.
   - Fix: add scenarios; final application coverage remains above every configured threshold.
7. Adversarial review found fail-open environment defaults, weak predictable-secret checks, long token limits, and bcrypt byte truncation risk.
   - Severity: high security.
   - Fix: require `NODE_ENV`/secret, generated-looking production secret policy, 15–30-minute token bounds, and 72-byte password validation.
8. Static boundaries could be bypassed with aliases, private adapters/lib/errors, re-exports, dynamic/template imports, and vendor subpaths.
   - Severity: high architecture/security.
   - Fix: resolve project aliases, inspect all import/export forms, broaden vendor regexes, and add negative RuleTester cases.
9. Logging/proxy hardening was incomplete.
   - Severity: high security/operations.
   - Fix: disable forwarded-IP trust until configured; recursively redact keys, quoted/error text, causes, cookies, and tokens while preserving sanitized diagnostics.
10. Governance review found precedence, mirror/router, enum-style, coverage wording, and stale-path drift.
    - Severity: high governance.
    - Fix: byte-sync full mirrors, compact family routers, unify precedence/auth paths/PascalCase examples/V8 wording, and index operational assets.

## Regression rerun

Final full test (36 files / 262 tests), coverage (99.6% statements/lines, 100% functions, 94.93% branches), lint, typecheck, build, formatting, and security gates pass.

## Stability decision

Locally stable. Zero open developer-blocking defects. Independent merge/release approvals remain separate governance gates.
