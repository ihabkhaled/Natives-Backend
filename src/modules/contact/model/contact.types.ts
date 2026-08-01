/** A validated contact-form submission handed to the use case. */
export interface ContactSubmission {
  readonly email: string;
  readonly subject: string;
  readonly message: string;
}

/** The result of a delivered contact submission. */
export interface ContactSendResult {
  readonly sent: true;
}
