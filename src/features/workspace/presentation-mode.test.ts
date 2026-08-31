import { describe, expect, it } from 'vitest';

import {
  presentationModeAvailable,
  resolveWorkspacePresentationMode,
  type WorkspacePresentationAvailability,
} from './presentation-mode';

const available: WorkspacePresentationAvailability = {
  scenarioCount: 3,
  proposalPending: false,
  runtimeAvailable: true,
};

describe('workspace presentation mode', () => {
  it('keeps supported local-only projections and always permits Design', () => {
    expect(resolveWorkspacePresentationMode('scenario', available)).toBe('scenario');
    expect(resolveWorkspacePresentationMode('runtime', available)).toBe('runtime');
    expect(presentationModeAvailable('design', available)).toBe(true);
    expect(presentationModeAvailable('scenario', available)).toBe(true);
    expect(presentationModeAvailable('runtime', available)).toBe(true);
  });

  it('makes a pending proposal the authoritative review projection', () => {
    const proposal = { ...available, proposalPending: true };
    expect(resolveWorkspacePresentationMode('design', proposal)).toBe('proposal');
    expect(resolveWorkspacePresentationMode('proposal', proposal)).toBe('proposal');
    expect(resolveWorkspacePresentationMode('scenario', proposal)).toBe('proposal');
    expect(resolveWorkspacePresentationMode('runtime', proposal)).toBe('proposal');
    expect(presentationModeAvailable('scenario', proposal)).toBe(false);
    expect(presentationModeAvailable('runtime', proposal)).toBe(false);
    expect(presentationModeAvailable('proposal', proposal)).toBe(true);
    expect(presentationModeAvailable('design', proposal)).toBe(false);
  });

  it('falls back to Design when the requested projection loses its source', () => {
    const unavailable = {
      scenarioCount: 0,
      proposalPending: false,
      runtimeAvailable: false,
    };
    expect(resolveWorkspacePresentationMode('scenario', unavailable)).toBe('design');
    expect(resolveWorkspacePresentationMode('proposal', unavailable)).toBe('design');
    expect(resolveWorkspacePresentationMode('runtime', unavailable)).toBe('design');
  });
});
