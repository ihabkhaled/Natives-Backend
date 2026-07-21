/**
 * The transport an outbound application email is handed to. Selecting the
 * adapter is a configuration decision (`EMAIL_PROVIDER`), never a branch at a
 * call site: use cases depend on `EmailSenderPort` and never learn which
 * transport is bound.
 *
 * `Console` is the default and the only implementation currently wired. It
 * renders the message and writes it to the structured log so a local or CI
 * environment can read exactly what a recipient would have received without a
 * credentialed provider. Adding a real transport is a new adapter bound to the
 * same port — see docs/product/open-decisions.md (OD-002).
 */
export enum EmailProvider {
  Console = 'console',
}

export const EMAIL_PROVIDER_VALUES: readonly EmailProvider[] =
  Object.values(EmailProvider);
