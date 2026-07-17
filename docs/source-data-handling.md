# Source-data handling (private team data)

The Ultimate Natives legacy source is a set of private Excel workbooks containing real member data
(names, contacts, possibly national IDs, private coach notes). These files are **business evidence, not
the target schema**, and are handled under strict privacy rules.

## Hard rules

- **Never commit** source workbooks, exports, uploads, local DB dumps, `.env*`, traces, or any file
  containing production names, contact details, national IDs, or private notes. Enforced by
  `.gitignore` (`/private-imports/`, `*.xlsx|xls|xlsm|csv|pdf`, `/exports/`, `/uploads/`, `*.sqlite|db|dump|bak`,
  `/traces/`).
- **Never log** tokens, passwords, national IDs, phone numbers, email addresses, private coach feedback,
  or raw uploaded file contents.
- Private workbooks live only in an ignored, access-controlled `private-imports/` directory that is
  never mounted into any committed service image.
- National IDs and other prohibited fields are **excluded by default** and never stored without a
  documented, approved need.

## Import boundary

All legacy data enters the system exclusively through the audited import pipeline (prompts 702–705):
private upload → hash & classify → parse (cached formula values are untrusted) → validate → resolve
identities → **dry-run (writes nothing)** → compare vs legacy → five-party sign-off → commit via normal
domain services with import idempotency + audit + outbox → reconcile → dispose/retain by policy.

- Imports are **dry-run capable, idempotent (by source hash + mapper version), resumable, reconciled,
  and auditable**. Never a generic ORM bulk insert.
- Previews, error reports, logs, and screenshots use **redacted identifiers** unless the operator holds
  explicit field permission.

## Fixtures and tests

- Test fixtures are **synthetic and deterministic** — reserved domain `example.test`, fake phone ranges,
  synthetic English + Arabic names. No data is ever copied from workbooks or real members.
- `null` means "not evaluated" and is never converted to zero.

## Source provenance

The uploaded archive (`Docs.zip`, SHA-256 `0b3c3d38d7bcd5d770945286c72770adbfc8bb5532f7e1aa5653d68ddc673da7`)
contained exactly 8 Excel workbooks and no PDFs. The originals are deliberately excluded from version
control; only safe metadata (hash, mapper version, result counts, operator, timestamps) is retained.
