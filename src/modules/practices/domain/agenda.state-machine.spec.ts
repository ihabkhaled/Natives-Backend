import { describe, expect, it } from 'vitest';

import { AgendaStatus } from '../model/agendas.enums';
import {
  allowedTransitions,
  canComplete,
  canEditStructure,
  canPublish,
  canRecordExecution,
  canTransition,
} from './agenda.state-machine';

describe('agenda.state-machine', () => {
  it('allows draft → published → completed and nothing else', () => {
    expect(allowedTransitions(AgendaStatus.Draft)).toEqual([
      AgendaStatus.Published,
    ]);
    expect(allowedTransitions(AgendaStatus.Published)).toEqual([
      AgendaStatus.Completed,
    ]);
    expect(allowedTransitions(AgendaStatus.Completed)).toEqual([]);
  });

  it('validates individual transitions', () => {
    expect(canTransition(AgendaStatus.Draft, AgendaStatus.Published)).toBe(
      true,
    );
    expect(canTransition(AgendaStatus.Draft, AgendaStatus.Completed)).toBe(
      false,
    );
    expect(canTransition(AgendaStatus.Completed, AgendaStatus.Published)).toBe(
      false,
    );
  });

  it('permits structural edits only while draft', () => {
    expect(canEditStructure(AgendaStatus.Draft)).toBe(true);
    expect(canEditStructure(AgendaStatus.Published)).toBe(false);
    expect(canEditStructure(AgendaStatus.Completed)).toBe(false);
  });

  it('permits publish only from draft', () => {
    expect(canPublish(AgendaStatus.Draft)).toBe(true);
    expect(canPublish(AgendaStatus.Published)).toBe(false);
    expect(canPublish(AgendaStatus.Completed)).toBe(false);
  });

  it('permits complete only from published', () => {
    expect(canComplete(AgendaStatus.Published)).toBe(true);
    expect(canComplete(AgendaStatus.Draft)).toBe(false);
    expect(canComplete(AgendaStatus.Completed)).toBe(false);
  });

  it('permits execution once published or completed', () => {
    expect(canRecordExecution(AgendaStatus.Published)).toBe(true);
    expect(canRecordExecution(AgendaStatus.Completed)).toBe(true);
    expect(canRecordExecution(AgendaStatus.Draft)).toBe(false);
  });
});
