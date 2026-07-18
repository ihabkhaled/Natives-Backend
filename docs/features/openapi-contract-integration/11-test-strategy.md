# Test strategy

- Unit: operation-ID creation, normalization, stable hashing, and compatibility classification,
  including additive response codes versus removed or changed responses.
- Backend integration: create the real Nest document twice and prove byte-identical output.
- Contract: verify representative auth, pagination, enum, UTC date-time, validation, forbidden, and
  error-envelope schemas and detect a breaking fixture.
- Frontend compile/unit: generated types compile and gateways agree with runtime schemas.
- Full-stack: synthetic login, session, practice list/detail/RSVP, denied scope, and offline/error
  presentation against the real backend.
- Security: no secret/PII patterns in artifacts; auth metadata on protected operations.
- Rollback: prior artifact remains consumable during the coordinated window.

Evidence records exact candidate SHAs and commands; unrun native checks remain UNVERIFIED.
