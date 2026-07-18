# Delivery plan

1. Add tests for reminder policy, quiet hours, calendar token hashing, ICS serialization, feed
   authorization, notification routes, and admin preview/test.
2. Add the reversible additive migration for feed credentials and quiet-hour preferences.
3. Add calendar token, repository, feed generation, DTO, controller, and error owners.
4. Extend platform notification routing for practice and attendance events and quiet-hour policy.
5. Add bounded admin preview/test orchestration through the outbox.
6. Update module/database/runbook/release documentation.
7. Run targeted tests, migration integration tests, full coverage, lint, typecheck, build, knowledge,
   contract, and available security gates.

Dependencies: prompts 105 and 200-202 are present. The shared branch contains unrelated active
OpenAPI/auth work; this slice avoids bootstrap and package ownership files.

Approvals: architecture, QA, security, operations, and release owner.
