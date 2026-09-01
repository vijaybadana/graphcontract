// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LandingPage } from './landing-page';

afterEach(() => cleanup());

describe('GraphContract landing page', () => {
  it('states the product contract and preserves the canvas destinations', () => {
    render(<LandingPage />);

    expect(
      screen.getByRole('heading', { name: 'Plan agent behavior before code.' }),
    ).toBeTruthy();
    expect(screen.getByText('Agents propose. Humans revise. Contracts freeze.')).toBeTruthy();
    expect(screen.getByText('Agent proposal')).toBeTruthy();
    expect(screen.getByText('Human review')).toBeTruthy();
    expect(screen.getByText('Frozen contract')).toBeTruthy();
    expect(screen.getByText('Implementation handoff')).toBeTruthy();

    const canvasLinks = screen.getAllByRole('link', { name: /Open (?:canvas|GraphContract)/ });
    expect(canvasLinks).toHaveLength(3);
    expect(canvasLinks.every((link) => link.getAttribute('href') === '/')).toBe(true);
    expect(screen.getByRole('link', { name: 'See how it works' }).getAttribute('href'))
      .toBe('#how-it-works');
  });

  it('keeps the lifecycle and product reasons concise and ordered', () => {
    render(<LandingPage />);

    expect(screen.getByRole('heading', { name: 'Propose' })).toBeTruthy();
    expect(screen.getByText('Agent drafts the behavior.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Review' })).toBeTruthy();
    expect(screen.getByText('Human changes boundaries.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Freeze' })).toBeTruthy();
    expect(screen.getByText('Contract becomes authoritative.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hand off' })).toBeTruthy();
    expect(screen.getByText('Scenarios guide implementation.')).toBeTruthy();

    expect(screen.getByRole('heading', { name: 'Shared visual language' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Human-owned approval' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Deterministic handoff' })).toBeTruthy();
  });
});
