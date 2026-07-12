# Operations Decisions

> Durable operational conventions for this workspace. Procedures live in [/runbooks](../runbooks/); the release gate lives in [release-checklist.md](./release-checklist.md) and [/testing/quality-gates.md](../testing/quality-gates.md). This file records the operational model this reference backend actually has, and states plainly where a full operations program (deployment topology, scaling, IaC) is not applicable yet.

Every line marked **Project records:** is a placeholder a concrete project fills in once. Until then, treat the stated default as the house standard.

---

## Decision: this reference backend has no deployment or infrastructure surface today

**What:** there is no Dockerfile, container orchestration manifest, or infrastructure-as-code (Terraform/Pulumi/CloudFormation/etc.) anywhere in this repository. `start:prod` (`node dist/src/main`) is the only production entrypoint defined.
**Why:** IronNest ships as a starter/reference backend a real project deploys on its own chosen platform — inventing a specific deployment topology here would document a decision nobody has actually made, which claude.md's "do not document assumptions as established facts" forbids.
**Project records:** the moment a real project picks a deployment target (container platform, serverless, bare VM), record it here and add the matching runbook under `/runbooks`.

---

## Decision: health and readiness are already wired, deployment-agnostically

**What:** `src/core/health/` exposes a health endpoint independent of any specific deployment platform; `src/bootstrap/configure-lifecycle.ts` owns graceful shutdown.
**Why:** these are runtime concerns the application owns regardless of where it deploys — no separate "operations" implementation is needed once a platform is chosen; the platform's own health-check/readiness-probe config just points at the existing endpoint.
**Specifics:** see `src/core/health/health.constants.ts` for the exact route; **Project records:** the probe configuration (interval, timeout, failure threshold) once a platform is chosen.

---

## Decision: the release gate is the operational readiness gate

**What:** [release-checklist.md](./release-checklist.md) and [/testing/quality-gates.md](../testing/quality-gates.md) already define what must be green before a change ships; `/runbooks/release-smoke-test-template.md` and `/runbooks/rollback-template.md` already define the rollout/rollback procedure shape.
**Why:** a separate "operations sign-off" document duplicating the same gate would be two owners for one concern (rule 45) — this file points at them instead of restating them.

## Sections not applicable today (reasoning recorded per section)

| Program area                                  | Status         | Why                                                                                                                                      |
| --------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Deployment topology / container orchestration | Not applicable | No Dockerfile, Kubernetes manifest, or equivalent exists in this repository                                                              |
| Infrastructure-as-code                        | Not applicable | No Terraform/Pulumi/CloudFormation or similar exists in this repository                                                                  |
| Scaling model / capacity plan                 | Not applicable | No deployment target has been chosen to scale                                                                                            |
| SLOs / SLIs / error budgets                   | Not applicable | No production traffic exists to measure against                                                                                          |
| Cost budget                                   | Not applicable | No hosting decision has been made                                                                                                        |
| Backup / disaster recovery                    | Not applicable | No persistence technology beyond the reference module's in-memory store is chosen yet ([database-decisions.md](./database-decisions.md)) |

**Accepted by:** repository architect. Revisit this table the moment any row's precondition changes — e.g. the first time a project built on IronNest adds a real database or a deployment manifest.

---

## Decision checklist

- [ ] A new integration, queue, or job ships with the config/bootstrap wiring rule 41 requires, not a bare code change
- [ ] Any new runbook need is added under `/runbooks`, not duplicated here
- [ ] The moment a deployment target is chosen, this file's "not applicable" table is revisited

**Related:** [release-checklist.md](./release-checklist.md) · [database-decisions.md](./database-decisions.md) · [/runbooks/README.md](../runbooks/README.md) · [/testing/quality-gates.md](../testing/quality-gates.md) · [/docs/sdlc/release-checklist.md](../docs/sdlc/release-checklist.md)
