# 02 — Business Development

- Commercial value: shortens safe onboarding and makes the first authenticated client experience usable without follow-up calls.
- Target audience: local developers and deployment operators; all authenticated web/mobile users consume the login contract.
- SLA/contract impact: no external SLA change. The login response is an intentional breaking API contract from flat tokens to nested `tokens` plus `user`.
- Rollout audience: backend and frontend must move together before a shared-environment release.
- Adoption risk: stale clients reading top-level `accessToken`/`refreshToken` will fail.
- Enablement: update API/module/database docs and test the exact response shape.
