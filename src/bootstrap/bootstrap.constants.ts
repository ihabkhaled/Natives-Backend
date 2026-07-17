export const LISTEN_HOST = '0.0.0.0';
export const TRUST_PROXY = false;

// 1 MiB request body cap — reject oversized payloads at the transport edge.
export const BODY_LIMIT_BYTES = 1_048_576;

export const DEFAULT_API_VERSION = '1';

export const SWAGGER_PATH = 'docs';
export const SWAGGER_TITLE = 'Service API';
export const SWAGGER_DESCRIPTION = 'HTTP API for this NestJS service';
export const SWAGGER_VERSION = '1.0.0';
export const SWAGGER_BEARER_NAME = 'jwt';
export const SWAGGER_PERSIST_AUTHORIZATION = false;
