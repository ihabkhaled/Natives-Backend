# 12 Coverage plan

Touched logic includes auth identity validation, identity mapping, session issuance, refresh-session and
invitation repositories, and four application operations. Each real branch is exercised; security-critical
ownership and token-state branches target 100%. Repository/application files must meet at least 95% lines,
statements, and functions with measured branches at or above the repository floor. DTOs, model declarations,
module wiring, and decorators follow configured exclusions and are proven through HTTP tests. No waiver is
requested.
