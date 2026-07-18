# 04 — Cross-Functional Refinement

| Function    | Finding / decision                                                                                                                                  | Owner         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Product/API | Approve nested login response as an intentional coordinated breaking contract.                                                                      | Product + API |
| Security    | Runtime password required; do not expose password/hash; normal app role does not need `CREATEDB`.                                                   | Security      |
| Database    | Database creation is an explicit operator action before migrations.                                                                                 | Database      |
| Backend     | Identity owns response mapping; RBAC is consumed through its module/public port.                                                                    | Backend       |
| QA          | Cover active/pending/suspended mapping, permission resolution, resolver failure behavior, setup validation, idempotent seed SQL, and HTTP contract. | QA            |
| Operations  | `db:setup` is local/manual bootstrap, not application startup.                                                                                      | Operations    |

Hidden work: update existing identity integration/E2E consumers from flat token access, add RBAC schema where permission resolution is exercised, and document rollback.

Open question accepted for later: memberships remain empty until the members bounded context exposes an intentional projection.
