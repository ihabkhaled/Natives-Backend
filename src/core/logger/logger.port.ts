export type LogContext = Readonly<Record<string, unknown>>;

/**
 * App-owned logging contract. Business and cross-cutting code depends on this
 * port (via `AppLogger`), never on the logging vendor. Swapping pino for
 * another logger touches only src/core/logger. See rules/12.
 */
export interface AppLoggerPort {
  setContext(context: string): void;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}
