// Paths pino-http redacts from every log line. Extend this list whenever a new
// sensitive header/body field is introduced (rules/14).
export const REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.token',
  'req.body.secret',
  'res.headers["set-cookie"]',
];

export const REDACT_CENSOR = '[Redacted]';

// Pretty, human-readable logs in local development only. Production stays JSON.
export const DEV_LOG_TRANSPORT = {
  target: 'pino-pretty',
  options: {
    singleLine: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
  },
};
