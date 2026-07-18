# Engineering standards check

| Area            | Constraint                                                                           |
| --------------- | ------------------------------------------------------------------------------------ |
| Backend layers  | Swagger construction stays in bootstrap/core ownership; controllers stay thin.       |
| Frontend layers | Generated code stays behind package/HTTP ownership; components remain UI-only.       |
| Contracts       | Stable operation IDs, deterministic serialization, checksum, runtime validation.     |
| Security        | No credentials/PII/examples from real data; auth and scope metadata remain explicit. |
| Testing         | Determinism, stale checks, breaking fixtures, compile, contract, and real flows.     |
| Focus           | Concise in-scope execution; no speculative unimplemented API surface.                |

Permanent focus-policy updates are handled in the canonical repository policies in this delivery.
