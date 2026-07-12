# Privacy Decisions

> Durable privacy conventions for this workspace. Hard security rules live in [00-non-negotiable-rules.md](../rules/00-non-negotiable-rules.md) and [07-security-authn-authz.md](../rules/07-security-authn-authz.md); this file records what personal data this reference backend actually processes, why most privacy-program sections are not applicable here, and where a real project pins its own specifics.

Every line marked **Project records:** is a placeholder a concrete project fills in once. Until then, treat the stated default as the house standard.

---

## Decision: this reference backend has a minimal privacy surface

**What:** the only personal data this codebase processes is authentication credentials — an email address and a bcrypt password hash (`src/modules/users/model/user.types.ts`, `src/modules/auth`). There is no profile data, no user-generated content beyond the `articles` reference module's title/body (attributed to `ownerId`, not to a real identity), no payment data, no location data, and no third-party data processor.
**Why:** IronNest is a reference/starter backend, not a product with a real user base — most of a full privacy program (data inventory across many data types, consent flows, third-party processing agreements, data subject access request tooling) has nothing to attach to yet. Documenting an empty privacy program as if it were populated would be worse than stating the gap plainly (claude.md: "do not document assumptions as established facts").
**Specifics (this project):** email + password hash only. **Project records:** the moment a real project adds profile data, uploads, analytics, or a third-party processor, this decision must be revisited and the sections below filled in for real.

---

## Decision: data minimization is enforced by the DTO boundary, not a separate privacy layer

**What:** every field a client can submit is declared and bounded in a DTO ([05-dto-and-validation.md](../rules/05-dto-and-validation.md)); there is no endpoint that accepts or returns more personal data than its DTO declares.
**Why:** the DTO boundary is already the single enforcement point for "what data enters/leaves the system" — duplicating that as a separate privacy-specific control would be two owners for one concern (rule 45).
**Specifics:** see [security-decisions.md](./security-decisions.md) for the input/output/upload safety conventions this shares.

---

## Decision: logging redaction already covers the privacy-relevant leak path

**What:** the logger adapter redacts secrets and PII before a log line is written ([observability-decisions.md](./observability-decisions.md) Decision 5, [14-observability-and-logging.md](../rules/14-observability-and-logging.md)).
**Why:** for a credentials-only data model, "don't log the password/token" is the entire practical privacy-in-logging surface.
**Project records:** if a real project adds richer personal data, extend the redaction list in `src/core/logger/` and record the new fields here.

## Sections not applicable today (reasoning recorded per section)

| Program area                                          | Status         | Why                                                                                          |
| ----------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| Data inventory across multiple data types             | Not applicable | Single data type (auth credentials) — see the decision above                                 |
| Consent management                                    | Not applicable | No optional data collection exists to consent to                                             |
| Retention and deletion policy beyond account deletion | Not applicable | No data class needs a different retention period than the account record itself              |
| Third-party data processing agreements                | Not applicable | No third-party processor is integrated in this reference app                                 |
| Data subject access/export/deletion tooling           | Not applicable | No standing user base; would be built alongside the first real product feature that needs it |
| Cross-border transfer review                          | Not applicable | No hosting/infrastructure decision has been made for this reference app                      |

**Accepted by:** repository architect. Revisit this table the moment any row's precondition changes.

---

## Decision checklist

- [ ] New endpoint/DTO reviewed for whether it adds a new personal-data field (if so, update the data-model line above)
- [ ] New logging call reviewed against the redaction list before it ships
- [ ] Any new third-party integration triggers a re-review of this file's "not applicable" table

**Related:** [security-decisions.md](./security-decisions.md) · [observability-decisions.md](./observability-decisions.md) · [/rules/07-security-authn-authz.md](../rules/07-security-authn-authz.md) · [/rules/14-observability-and-logging.md](../rules/14-observability-and-logging.md) · [/docs/sdlc/security-baseline.md](../docs/sdlc/security-baseline.md)
