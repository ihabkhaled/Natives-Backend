# Cross-functional refinement

- Product: preserve current implemented behavior; do not scaffold missing modules.
- Architecture: backend OpenAPI is canonical; generated code is infrastructure, never domain logic.
- Frontend: Zod/runtime validation remains mandatory even with generated compile-time types.
- QA: test deterministic generation, stale checks, route parity, invalid responses, and real flows.
- Security: never include secrets or example tokens; generated examples are synthetic.
- Operations: artifact/checksum and generation commands must be stable in CI and local development.
- Decision: coordinated breaking payload changes require expand/contract notes and both repos green.
