# 04 Cross-functional refinement

- Product: preserve current-device semantics and avoid invented location/team data.
- Backend: extend the existing identity repository and use-case ownership; keep controllers one-call thin.
- Frontend: existing routes are evidence, while backend OpenAPI remains canonical.
- QA: cover 401, pagination bounds, ownership isolation, current-session preservation, empty lists, and
  invitation lifecycle denial.
- Security: session ID comes only from the signed access token; database queries scope by `user_id`;
  invitation lookup hashes the opaque token and never searches by email.
- Operations: no migration/config/deployment change; existing auth/security-event monitoring applies.
- Support: device labels are user-agent labels supplied at login, not forensic fingerprints.

Decision: implement truthful conservative projections and leave absent team context out of the contract.
