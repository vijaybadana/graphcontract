import { expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

export async function downloadText(page: Page, filename: string): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: `Download ${filename}` }).click(),
  ]);

  expect(download.suggestedFilename()).toBe(filename);
  const path = await download.path();
  if (!path) throw new Error(`Browser did not persist ${filename}`);
  return readFile(path, 'utf8');
}
