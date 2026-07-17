export interface ClockPort {
  now(): Date;
  uptime(): number;
}

export const CLOCK_PORT = Symbol('CLOCK_PORT');
