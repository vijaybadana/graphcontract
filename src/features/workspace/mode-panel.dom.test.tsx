// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ModePanelShell, ModePathStrip } from './mode-panel';

afterEach(cleanup);

describe('mode panel presentation contract', () => {
  it('uses the shared compact mode-header and rail sizing tokens', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/features/workspace/mode-panel.css'), 'utf8');

    expect(css).toContain('--mode-rail-padding: 14px');
    expect(css).toContain('--mode-header-icon-size: 32px');
    expect(css).toContain('--mode-header-glyph-size: 16px');
    expect(css).toContain('--mode-header-action-size: 32px');
    expect(css).toContain('--mode-row-min-height: 38px');
  });

  it('renders one mode surface with the compact header and accessible collapse action', () => {
    render(
      <ModePanelShell
        title="Scenarios"
        icon={<svg data-testid="mode-glyph" />}
        tone="scenario"
        badge="8 paths"
        onCollapse={() => {}}
      >
        <p>Content</p>
      </ModePanelShell>,
    );

    expect(screen.getByRole('region', { name: 'Scenarios panel' }).getAttribute('data-mode-panel')).toBe('scenario');
    expect(screen.getByRole('heading', { name: 'Scenarios' })).toBeTruthy();
    expect(screen.getByText('8 paths').classList.contains('mode-panel__badge')).toBe(true);
    expect(screen.getByRole('button', { name: 'Collapse scenarios panel' }).classList.contains('mode-panel__collapse')).toBe(true);
  });

  it('collapses every long path to stable endpoints and an accessible summary, then expands in place', () => {
    const items = Array.from({ length: 8 }, (_, index) => ({
      id: `node-${index + 1}`,
      label: `Node ${index + 1}`,
      icon: <span aria-hidden="true">•</span>,
    }));
    const { rerender } = render(<ModePathStrip items={items} loopCount={2} />);

    expect(document.querySelectorAll('.mode-path-strip__node')).toHaveLength(3);
    expect(screen.getByText('+5 more').getAttribute('title')).toBe('5 remaining path steps hidden');
    expect(screen.getByLabelText('5 remaining path steps hidden')).toBeTruthy();
    expect(screen.getByText('Loop ×2')).toBeTruthy();

    rerender(<ModePathStrip items={items} expanded loopCount={2} />);

    expect(document.querySelectorAll('.mode-path-strip__node')).toHaveLength(8);
    expect(screen.queryByText('+5 more')).toBeNull();
    expect(screen.queryByText('Loop ×2')).toBeNull();
    expect(document.querySelector('.mode-path-strip.is-expanded')).toBeTruthy();
  });
});
