# Open product decisions

Unresolved product choices. An unresolved decision must **not** be hidden by an arbitrary
implementation choice — features remain disabled or explicitly flagged until a named decision, version,
effective date, owner, and approval exist. Legacy spreadsheet values are treated as **candidates**, not
final policy (see `11-SCHEMAS/legacy-business-rules.yaml` in the prompt pack).

| ID     | Decision                                                                  | Default until resolved                                      | Status |
| ------ | ------------------------------------------------------------------------- | ----------------------------------------------------------- | ------ |
| OD-001 | Production hosting and object-storage provider                            | Local/dev adapters only                                     | OPEN   |
| OD-002 | Email / SMS / push notification provider                                  | Console email adapter (see below); provider behind adapter  | OPEN   |
| OD-003 | Public registration allowed?                                              | Admin invitation only                                       | OPEN   |
| OD-004 | Final weighted formula for player/team overall score                      | Legacy weights as versioned **candidate** rule only         | OPEN   |
| OD-005 | Final points for WFDF accreditation                                       | `null` (disabled) — never guessed                           | OPEN   |
| OD-006 | Final badge thresholds above the legacy 450-point tier                    | Tiers >100/>200/>450 candidate; >649 disabled (broken #REF) | OPEN   |
| OD-007 | Do jersey and board-governance modules ship in the first release?         | Deferred / optional                                         | OPEN   |
| OD-008 | Are national ID values imported at all?                                   | **Do not import** (prohibited by default)                   | OPEN   |
| OD-009 | Match scorekeeping fully live vs post-match only in first release         | Post-match capable; live behind flag                        | OPEN   |
| OD-010 | Attendance denominator rule (excused excluded?) and late/absent penalties | Legacy candidate; versioned + admin-approved rule required  | OPEN   |

## OD-002 stand-in: the console email transport

No email provider is contracted, so none is integrated. Rather than leave invitation delivery as a
manual step, the outbound-email seam exists now and a **console transport is bound by default**, so
creating or resending an invitation always sends — there is no separate "now deliver it" action.

**The seam.** `EmailSenderPort` (`src/core/email/email-sender.port.ts`) takes one already-rendered
`EmailMessage`. Application code depends only on the `EMAIL_SENDER_PORT` token; no use case, controller,
or test names a transport. Rendering lives in the owning module's domain layer
(`src/modules/identity/domain/invitation-email.template.ts`), so the transport never composes copy.

**The default adapter.** `ConsoleEmailSenderService` writes the rendered message to the structured log
at `info` with `to`, `subject`, `body`, `actionUrl`, and a `notice` naming the transport. It never
rejects, so a send is never fatal.

**On the token in logs.** `AppLogger` sanitizes log context and redacts `token=` assignments, so the
one-time credential inside the accept link is censored in the log _by design_ — a live invitation
credential must not sit in a log file. The usable link is still returned exactly once, to the
authorized admin, in the `POST /invitations` and `POST /invitations/:id/resend` response bodies. That
response remains the manual-delivery fallback while the console transport is bound, and the logged
notice says so.

**Configuration** (`src/config/email.config.ts`, typed via `AppConfigService.email`):

| Variable             | Default                          | Meaning                                            |
| -------------------- | -------------------------------- | -------------------------------------------------- |
| `EMAIL_PROVIDER`     | `console`                        | Which adapter binds to `EMAIL_SENDER_PORT`         |
| `WEB_BASE_URL`       | `http://localhost:5173`          | Origin the accept-invitation link is built against |
| `EMAIL_FROM_ADDRESS` | `no-reply@ultimatenatives.local` | Envelope sender for a real transport               |

An unrecognised `EMAIL_PROVIDER` falls back to `console` rather than failing boot: an operator typo
must not silently stop invitations from going somewhere observable.

**Swapping in a real provider** — one adapter plus one line, no call-site changes:

1. Add the member to `EmailProvider` (`src/shared/enums/email-provider.enum.ts`), e.g. `Smtp = 'smtp'`.
2. Add an adapter implementing `EmailSenderPort` beside the console one, keeping the vendor SDK inside
   that file. Read credentials through `AppConfigService`, never `process.env` directly.
3. Add its `case` to `selectSender` in `src/core/email/email.module.ts` and list it in `providers`.
4. Set `EMAIL_PROVIDER` and `WEB_BASE_URL` in the environment.

Resolving OD-002 means completing those steps and flipping this row to CLOSED. Until then the default
stays `console`.

## Deferred to specific prompts

- Native bundle IDs, signing, icons, and splash assets → prompt **800** (branding). Display identity is
  set to "Ultimate Natives" from that prompt onward; the inherited template display name and bundle ID
  remain until then to keep the deep-link/env/identity test suite intact.
