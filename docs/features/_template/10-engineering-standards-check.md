# 10 - Engineering Standards Check

## Purpose

Freeze the implementation rules before coding begins.

## Step-by-Step Workflow

1. Review the permanent engineering standards.
2. Identify any request-specific rules.
3. Record how the change will satisfy code quality, security, observability, i18n, accessibility, and documentation expectations.
4. Update `claude.md` if a new permanent rule emerges.

## Standards Review Matrix

| Standard area               | Requirement | How this request will comply |
| --------------------------- | ----------- | ---------------------------- |
| Architecture boundaries     |             |                              |
| Naming and module structure |             |                              |
| Error handling              |             |                              |
| Logging and observability   |             |                              |
| Accessibility               |             |                              |
| Localization / content      |             |                              |
| Secure coding               |             |                              |
| Data handling               |             |                              |
| Documentation               |             |                              |
| Release readiness           |             |                              |

## Request-Specific Rules

- [Rule 1]

## Claude Policy Update Check

- New permanent rule discovered: [yes / no]
- If yes, describe the rule: [text]
- `claude.md` updated: [yes / no / pending]

## Exit Checklist

- [ ] Standards reviewed
- [ ] Request-specific rules documented
- [ ] Permanent-rule update decision made
- [ ] Implementation constraints are visible to the team

## Sign-Off

| Role            | Name | Decision         | Date |
| --------------- | ---- | ---------------- | ---- |
| Technical owner |      | approve / revise |      |

## Evidence And References To Attach

- relevant standards docs, style guides, ADRs, security baselines, and testing baselines
- links to permanent-rule updates if needed

## Phase Blockers

Do not close this phase if:

- request-specific constraints are only in someone’s head
- permanent-rule implications were noticed but not reflected in `claude.md`
- implementation standards still differ between people working the change
