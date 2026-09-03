import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

const entries = [
  ['hierarchical-deep-research', 'Hierarchical Deep Research', 'langchain-ai/open_deep_research'],
  ['guarded-coding-agent-delivery', 'Guarded Coding-Agent Delivery', 'langchain-ai/open-swe'],
  ['evidence-to-approved-social-content', 'Evidence-to-Approved Social Content', 'CopilotKit/open-fullstack-social-media-agent'],
  ['multi-stage-expert-review', 'Multi-Stage Expert Review', 'TauricResearch/TradingAgents'],
  ['guarded-natural-language-to-sql', 'Guarded Natural-Language-to-SQL', 'tharunramavath/AI-Powered-SQL-Agent'],
  ['email-triage-with-human-review', 'Email Triage with Human Review', 'langchain-ai/agents-from-scratch-ts'],
  ['human-approved-incident-response', 'Human-Approved Incident Response', 'AttiR/OpsCanvas'],
  ['specialist-travel-support', 'Specialist Travel Support', 'ro-anderson/multi-agent-rag-customer-support'],
  ['voice-specialist-handoffs', 'Voice Specialist Handoffs', 'langchain-ai/pipecat-langgraph-example'],
  ['parallel-research-with-reflection', 'Parallel Research with Reflection', 'google-gemini/gemini-fullstack-langgraph-quickstart'],
] as const;

async function openLibrary(page: Page) {
  await page.getByRole('button', { name: 'Workflow library, 10 templates' }).click();
  await expect(page.getByRole('dialog', { name: 'Graph library' })).toBeVisible();
}

test('every library card exposes complete metadata and a canonical safe source link', async ({ app }) => {
  await openLibrary(app);

  for (const [id, title, source] of entries) {
    const card = app.locator(`article[data-entry-id="${id}"]`);
    await expect(card).toBeVisible();
    await expect(card.getByRole('button', { name: `Open ${title}` })).toBeEnabled();
    await expect(card.getByRole('img', { name: `${title} topology` })).toBeVisible();
    await expect(card.locator('.graph-library-card__outcome')).not.toHaveText('');
    await expect(card.locator('.graph-library-card__domain')).not.toHaveText('');
    await expect(card.locator('.graph-library-card__complexity')).toHaveText(
      /^(foundational|intermediate|advanced)$/,
    );
    await expect.poll(() => card.locator('.graph-library-card__chips > span').count()).toBeGreaterThanOrEqual(3);
    const sourceLink = card.getByRole('link', { name: `Open Inspired by ${source} on GitHub` });
    await expect(sourceLink).toHaveAttribute('href', `https://github.com/${source}`);
    await expect(sourceLink).toHaveAttribute('target', '_blank');
    await expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(card.getByText('Normalized — no source code copied', { exact: true })).toBeVisible();
    await expect(card.locator('.graph-library-card__source-note')).not.toHaveText('');
  }
});
