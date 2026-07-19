import type {
  AttemptInput,
  ProtocolContent,
  ProtocolContentInput,
  RawAttemptInput,
  SessionContent,
  SessionContentInput,
} from '../model/measurements.types';

/**
 * Normalizes loosely-typed transport input into the strict command shapes the
 * application layer consumes. Absent optional fields become explicit null (or the
 * documented boolean default), keeping controllers a single delegation and every
 * downstream layer free of `undefined`.
 */
export function toProtocolContent(
  input: ProtocolContentInput,
): ProtocolContent {
  return {
    protocolKey: input.protocolKey,
    name: input.name,
    description: input.description ?? null,
    seasonId: input.seasonId ?? null,
    discipline: input.discipline,
    unit: input.unit,
    direction: input.direction,
    resultPolicy: input.resultPolicy,
    instructions: input.instructions ?? null,
    safetyNotes: input.safetyNotes ?? null,
    minValue: input.minValue ?? null,
    maxValue: input.maxValue ?? null,
  };
}

export function toSessionContent(input: SessionContentInput): SessionContent {
  return {
    title: input.title,
    seasonId: input.seasonId ?? null,
    scheduledAt: input.scheduledAt,
    location: input.location ?? null,
    conditions: input.conditions ?? null,
    notes: input.notes ?? null,
  };
}

export function toAttemptInputs(
  inputs: readonly RawAttemptInput[],
): readonly AttemptInput[] {
  return inputs.map(input => toAttemptInput(input));
}

function toAttemptInput(input: RawAttemptInput): AttemptInput {
  return {
    value: input.value ?? null,
    unit: input.unit,
    valid: input.valid ?? true,
    disqualified: input.disqualified ?? false,
    dqReason: input.dqReason ?? null,
    notes: input.notes ?? null,
  };
}
