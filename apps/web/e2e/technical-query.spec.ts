import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import type { TechnicalQueryResponse } from '@thenodewalk/contracts';

const SOURCE_URL = 'https://example.com/';

const RESPONSE: TechnicalQueryResponse = {
  summary: 'Netflix relies on a federated API gateway to scale its services.',
  graph: {
    nodes: [
      { id: 'gateway', label: 'API Gateway', type: 'concept', sourceUrl: SOURCE_URL },
      { id: 'services', label: 'Microservices', type: 'concept', sourceUrl: SOURCE_URL },
    ],
    edges: [{ source: 'gateway', target: 'services', relationship: 'routes to' }],
  },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

test.describe('technical query flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock the RAG API so the flow is deterministic and infra-independent.
    await page.route('**/technical-queries', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }
      await route.fulfill({
        status: 201,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(RESPONSE),
      });
    });
    // Stub the external source so opening a node does not hit the network.
    await context.route(SOURCE_URL, async (route) => {
      await route.fulfill({ contentType: 'text/html', body: '<html><body>Source</body></html>' });
    });
  });

  test('renders the summary and an interactive, source-linked graph', async ({ page }) => {
    await page.goto('/ask');

    await page
      .getByRole('searchbox', { name: /ask a technical question/i })
      .fill('How does Netflix scale its API?');
    await page.getByRole('button', { name: /search/i }).click();

    await expect(page.getByText(/federated api gateway/i)).toBeVisible();

    const nodeLink = page.getByRole('link', { name: /api gateway, open source in a new tab/i });
    await expect(nodeLink).toBeVisible();
    await expect(nodeLink).toHaveAttribute('href', SOURCE_URL);

    const popup = await Promise.all([page.waitForEvent('popup'), nodeLink.click()]).then(
      ([openedPopup]) => openedPopup,
    );
    await popup.waitForLoadState();
    expect(popup.url()).toBe(SOURCE_URL);
    await popup.close();
  });

  test('the query flow has no critical or serious accessibility violations', async ({ page }) => {
    await page.goto('/ask');

    await page
      .getByRole('searchbox', { name: /ask a technical question/i })
      .fill('How does Netflix scale its API?');
    await page.getByRole('button', { name: /search/i }).click();
    await expect(page.getByText(/federated api gateway/i)).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );

    expect(blocking).toEqual([]);
  });
});
