/**
 * Minimal structural contract for an HTTP reply, satisfied by the platform's
 * reply object (Fastify today). Keeps cross-cutting code (exception filter)
 * decoupled from the HTTP platform vendor, which is importable only in
 * bootstrap/. See rules/12.
 */
export interface HttpReplyLike {
  status(statusCode: number): HttpReplyLike;
  send(body: unknown): unknown;
}
