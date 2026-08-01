/**
 * The low-level SMTP transport seam. A single vendor (nodemailer) sits behind
 * this port in `NodemailerTransportAdapter`; nothing above the adapter imports
 * the vendor, so swapping it is a one-file change (rule 12).
 */

/** Connection + credential inputs for a transport instance. */
export interface MailTransportOptions {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  /** Omitted for an unauthenticated relay; otherwise the login pair. */
  readonly auth: { readonly user: string; readonly pass: string } | undefined;
}

/** One fully addressed message handed to the transport. */
export interface MailSendInput {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  /** Optional Reply-To; omitted when replies to `from` are fine. */
  readonly replyTo?: string;
}

export interface MailTransportPort {
  sendMail(input: MailSendInput): Promise<void>;
}
