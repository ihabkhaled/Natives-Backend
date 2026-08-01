/**
 * The transport an outbound application email is handed to. Selecting the
 * adapter is a configuration decision (`EMAIL_PROVIDER`), never a branch at a
 * call site: use cases depend on `EmailSenderPort` and never learn which
 * transport is bound.
 *
 * `Console` is the default: it renders the message and writes it to the
 * structured log so a local or CI environment can read exactly what a recipient
 * would have received without a credentialed provider. `Smtp` delivers for real
 * through a nodemailer transport (wrapped behind an adapter) and is selected only
 * when `EMAIL_ENABLED=true` — see docs/product/open-decisions.md (OD-002).
 */
export enum EmailProvider {
  Console = 'console',
  Smtp = 'smtp',
}

export const EMAIL_PROVIDER_VALUES: readonly EmailProvider[] =
  Object.values(EmailProvider);
