/**
 * One fully rendered outbound email. Rendering happens in the owning module's
 * domain layer, so the transport never composes copy and never learns why the
 * message is being sent.
 */
export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  /** Plain-text body. Already contains any recipient-facing link. */
  readonly body: string;
  /**
   * The single action the recipient is expected to take, kept separate from the
   * body so an adapter can surface it (a button, a log field) without parsing
   * prose. Null when the message has no call to action.
   */
  readonly actionUrl: string | null;
}

/**
 * The outbound-email boundary. Application code depends on this port and never
 * on a transport: which adapter is bound is decided once, by configuration, in
 * `EmailModule`. No vendor SDK, credential, or provider-specific error leaks
 * past this seam.
 *
 * `send` resolves when the message has been handed to the transport. It does
 * not promise delivery to a mailbox — no transport can — so callers must not
 * treat a resolved promise as proof of receipt.
 */
export interface EmailSenderPort {
  send(message: EmailMessage): Promise<void>;
}

export const EMAIL_SENDER_PORT = Symbol('EMAIL_SENDER_PORT');
