export enum LogLevel {
  Debug = 'debug',
  Error = 'error',
  Fatal = 'fatal',
  Info = 'info',
  Silent = 'silent',
  Trace = 'trace',
  Warn = 'warn',
}

export const LOG_LEVEL_VALUES: readonly LogLevel[] = Object.values(LogLevel);
