// Paths pino-http redacts from every log line. Extend this list whenever a new
// sensitive header/body field is introduced (rules/14).
export const REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.referer',
  'req.headers.referrer',
  'req.body.password',
  'req.body.token',
  'req.body.accessToken',
  'req.body.refreshToken',
  'req.body.secret',
  'req.body.apiKey',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
];

export const REDACT_CENSOR = '[Redacted]';
export const SENSITIVE_HTTP_URL_SEGMENTS = [
  { routeMarker: '/auth/invitations/' },
  { routeMarker: '/calendar/feeds/', preservedSuffix: '.ics' },
] as const;
export const HTTP_URL_SEGMENT_END_PATTERN = /[/?#]/u;
export const CIRCULAR_LOG_VALUE = '[Circular]';
export const SENSITIVE_LOG_KEY_NAMES: readonly string[] = [
  'apikey',
  'authorization',
  'cookie',
  'password',
  'refreshtoken',
  'secret',
  'setcookie',
  'token',
  'accesstoken',
];
export const BEARER_LOG_PATTERN = /\bBearer\s+\S+/giu;
export const BEARER_LOG_REPLACEMENT = 'Bearer [Redacted]';
export const SENSITIVE_LOG_ASSIGNMENT_PATTERN =
  /["']?(password|token|accessToken|refreshToken|secret|apiKey|authorization|set-cookie|cookie)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^,\s}]+)/giu;
export const SENSITIVE_LOG_ASSIGNMENT_REPLACEMENT = '$1=[Redacted]';

// Pretty, human-readable logs in local development only. Production stays JSON.
export const DEV_LOG_TRANSPORT = {
  target: 'pino-pretty',
  options: {
    singleLine: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
  },
};
