# 00 - Request Intake and Classification

## Purpose

Classify the request before solutioning begins.

## Step-by-Step Workflow

1. Assign a unique request ID.
2. Record the request source and sponsoring team.
3. Classify the request type.
4. Identify affected domains and systems.
5. Assess severity, urgency, and whether the request is standard track or hotfix track.
6. Flag critical-risk areas such as auth, money flow, privacy, tenant isolation, reporting, or external integrations.
7. Assign accountable owners.

## Request Record

| Field           | Value                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| Request ID      | `<request-id>`                                                                                                     |
| Feature slug    | `<feature-slug>`                                                                                                   |
| Request title   |                                                                                                                    |
| Request type    | feature / bug / enhancement / refactor / migration / security fix / performance / compliance / UX / infrastructure |
| Request source  | ticket / email / client / support / incident / roadmap / audit                                                     |
| Requested by    |                                                                                                                    |
| Intake owner    |                                                                                                                    |
| Business owner  |                                                                                                                    |
| Technical owner |                                                                                                                    |
| Requested date  |                                                                                                                    |
| Target timeline |                                                                                                                    |

## Affected Domains

- [ ] Frontend
- [ ] Backend
- [ ] Mobile
- [ ] Database
- [ ] DevOps / platform
- [ ] Security
- [ ] Analytics / BI
- [ ] AI / model behavior
- [ ] Integrations
- [ ] Support / customer operations
- [ ] Legal / compliance
- [ ] Documentation

## Criticality and Delivery Track

| Item                             | Answer   |
| -------------------------------- | -------- |
| Severity                         |          |
| Urgency                          |          |
| Standard or hotfix track         |          |
| Customer-facing                  | yes / no |
| Revenue or money flow impact     | yes / no |
| Auth or permission impact        | yes / no |
| Privacy or regulated data impact | yes / no |
| External integration impact      | yes / no |
| Production incident related      | yes / no |

## Initial Scope Summary

### Problem statement

[Summarize the request in plain language.]

### Systems likely impacted

[List products, services, modules, data stores, pipelines, dashboards, workflows, or support processes likely to change.]

### Known dependencies

[List upstream teams, external vendors, approvals, environments, contracts, or existing blockers.]

### Intake assumptions

[List assumptions made because details are missing.]

## Exit Checklist

- [ ] Request ID assigned
- [ ] Type classified
- [ ] Domains identified
- [ ] Severity and urgency recorded
- [ ] Owners assigned
- [ ] Delivery track chosen
- [ ] Criticality flags documented

## Sign-Off

| Role         | Name | Decision         | Date |
| ------------ | ---- | ---------------- | ---- |
| Intake owner |      | approve / revise |      |

## Evidence And References To Attach

- source ticket, email, incident, request thread, or roadmap reference
- links to previous related requests if this is follow-on work
- incident IDs or support cases if this is reactive work
- named owners and escalation contacts

## Phase Blockers

Do not close this phase if:

- the request type is still ambiguous
- ownership is still ambiguous
- severity or urgency is guessed but not recorded
- critical-risk areas were not reviewed
- the request does not yet have a stable identifier
