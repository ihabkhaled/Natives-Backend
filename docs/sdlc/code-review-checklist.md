# Code Review Checklist

## Purpose

Use this checklist for every pull request or change review. A reviewer should be able to answer each item clearly.

## Review Preparation

- Read the request summary and linked phase artifacts.
- Confirm the PR scope matches the documented plan.
- Confirm the PR is reviewable in size and logically cohesive.

## Evidence Reviewers Should Expect

- linked request artifact or summary
- acceptance criteria
- test evidence or test plan
- documentation updates for changed behavior
- migration or rollback notes when relevant
- risk notes for unusual trade-offs or waivers

## Checklist

### Scope and Intent

- [ ] The change solves the documented problem.
- [ ] Scope is consistent with product requirements.
- [ ] Hidden extra behavior has not been introduced.

### Architecture and Design

- [ ] The change respects module and service boundaries.
- [ ] Architectural impacts are documented.
- [ ] A new ADR exists when architecture changed.
- [ ] Refactors are separated or clearly explained.

### Code Quality

- [ ] Naming is clear and consistent.
- [ ] Complexity is proportionate to the problem.
- [ ] Duplication is avoided or justified.
- [ ] Error handling is explicit.
- [ ] Logging and observability are present where needed.

### Readability and Simplicity

- [ ] A junior engineer can follow the flow; a senior engineer can trust the boundaries.
- [ ] Existing owners were reused; no parallel duplicate helper, constant, validator, or permission logic was added.
- [ ] No speculative abstraction, unused config/env value, or "maybe later" code shipped.
- [ ] No clever expressions the team must decode: nested ternaries, dense one-liners, type gymnastics.
- [ ] No safety control (validation, guards, ownership checks, error keys, bounds, tests, docs) was cut in the name of simplicity.
- [ ] The full readability question list in `rules/24-team-readable-code-review.md` (and the baseline in `docs/sdlc/simple-readable-code.md`) was applied.

### Security and Privacy

- [ ] Auth and permission behavior is correct.
- [ ] Sensitive data is protected and redacted.
- [ ] Input validation and output safety are covered.
- [ ] Abuse paths and misuse cases were considered.

### Data and Compatibility

- [ ] Schema or contract changes are documented.
- [ ] Migrations and rollback are present when needed.
- [ ] Backward compatibility impact is known.

### Tests

- [ ] Tests exist for the changed behavior.
- [ ] Tests cover happy path, failure path, and edge cases appropriate to the risk.
- [ ] Touched-module coverage meets the threshold or has an approved waiver.
- [ ] Regression scope is identified.

### Documentation

- [ ] Required docs were updated.
- [ ] Release notes were updated when behavior changed.
- [ ] Support or runbook docs were updated when operations changed.

### Release Readiness

- [ ] Feature flags, rollout, and rollback needs are covered.
- [ ] Monitoring and alerts are addressed when required.
- [ ] No unresolved blocker remains hidden in comments.

## Review Outcomes

- Use `MUST FIX` for blockers.
- Use `SHOULD FIX` for important improvements before merge when reasonable.
- Use `FOLLOW-UP` only for non-blocking items with explicit owner and due date.

## Automatic Blockers

Do not approve when any of the following are true:

- the reviewer cannot explain the change clearly
- architecture or contract impact is unclear
- failure-path handling is missing for critical workflows
- tests do not match the actual risk
- docs are stale for changed behavior
- rollback or migration risk is unaddressed
- open security or privacy concerns are hand-waved

## Approval Rule

Do not approve when a blocker remains unresolved, when artifacts are missing, or when the reviewer cannot explain the change with confidence.

## Review Record Quality

Review comments should be specific enough that another engineer could understand:

- what is wrong
- why it matters
- what evidence is missing
- what would make the issue resolved
