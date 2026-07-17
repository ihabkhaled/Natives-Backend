# Public Reference Points

## Purpose

This repository is generic and does not claim to reproduce any private internal workflow from any company. It is informed by publicly available engineering and security guidance that reflects the kind of rigor expected in high-performing software organizations.

## Reference Themes

### Small, Reviewable Changes

- Google Engineering Practices emphasizes small changelists, tests with the change, and easier rollback.

### Fast, Serious Code Review

- Google Engineering Practices emphasizes timely review, preserving code health, and reviewer clarity.

### Release Governance and Rollback Discipline

- Google SRE release engineering guidance emphasizes controlled release processes, gated operations, archived release artifacts, and test-bearing releases.

### Blameless Postmortems and Organizational Learning

- Google SRE postmortem guidance emphasizes written postmortems, action tracking, and blameless learning after incidents.

### Secure Software Supply Chain

- Google Cloud guidance emphasizes build provenance, delivery integrity, and stronger CI/CD controls.

### Security, Privacy, Auditability, and Administrative Controls

- OpenAI public security materials emphasize encryption, testing, monitoring, compliance support, administrative controls, and audit-oriented enterprise features.

## How To Use These References

- use them as public justification for rigor, not as a claim that this repository reproduces any private internal process
- prefer the principles over stack-specific implementation detail
- translate the ideas into local language, tooling, and architecture rather than copying terminology blindly

## Recommended Links

- Google Engineering Practices: https://google.github.io/eng-practices/
- Small CLs: https://google.github.io/eng-practices/review/developer/small-cls.html
- Emergencies: https://google.github.io/eng-practices/review/emergencies.html
- Code review standard: https://google.github.io/eng-practices/review/reviewer/standard.html
- Google SRE release engineering: https://sre.google/sre-book/release-engineering/
- Google SRE postmortem culture: https://sre.google/sre-book/postmortem-culture/
- Google Cloud software supply chain security: https://docs.cloud.google.com/software-supply-chain-security/docs/overview
- OpenAI security: https://openai.com/security
- OpenAI compliance APIs for enterprise customers: https://help.openai.com/en/articles/9261474-compliance-apis-for-enterprise-customers
