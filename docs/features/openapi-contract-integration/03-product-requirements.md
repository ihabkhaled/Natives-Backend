# Product requirements

- Backend OpenAPI JSON is deterministic, versioned, checksummed, and generated from the real app.
- Each operation has a stable operation ID, tag, security declaration, request/response schema, and
  sanitized error contract.
- Frontend generated types originate from the committed backend artifact; feature modules consume
  them only through the owned contract/HTTP surface and validated schemas.
- CI rejects stale artifacts and unreviewed breaking drift.
- Active auth and practice routes are aligned; unavailable dashboard behavior is explicit, not a
  fake success.
- Errors remain localized in English/Arabic at the client boundary.
- Loading, offline, permission, and incompatibility states are safe and accessible.
- Non-goal: inventing contracts for product modules that are not implemented yet.
