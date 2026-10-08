import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import type { TechnicalQueryResponse } from '@thenodewalk/contracts';

const SOURCE_URL = 'https://example.com/';

const RESPONSE: TechnicalQueryResponse = {
  summary: 'Netflix relies on a federated API gateway to scale its services.',
  graph: {
    nodes: [
      {
        id: 'gateway',
        label: 'API Gateway',
        type: 'concept',
        source: {
          kind: 'post',
          url: SOURCE_URL,
          articleTitle: 'Scaling the Netflix API',
          blogName: 'Netflix',
          publishedAt: '2026-01-02T00:00:00.000Z',
        },
      },
      { id: 'services', label: 'Microservices', type: 'concept', source: null },
      {
        id: 'book',
        label: 'Feedback loops',
        type: 'concept',
        source: {
          kind: 'book',
          bookTitle: 'Engineering Feedback',
          sectionTitle: 'Small loops',
          pageStart: null,
        },
      },
    ],
    edges: [
      { source: 'gateway', target: 'services', relationship: 'routes to' },
      { source: 'gateway', target: 'book', relationship: 'improves with' },
    ],
    centralNodeId: 'gateway',
  },
};

/**
 * axe samples computed colours, so a CSS transition still running (for example the
 * selected-node `transition-colors`) yields intermediate colours and flaky contrast
 * results. Wait for every running animation and transition to settle first.
 */
async function settleTransitions(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(
      document.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

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

    const nodeLink = page.getByRole('button', {
      name: /api gateway, main idea, view article details/i,
    });
    await expect(nodeLink).toBeVisible();
    await expect(nodeLink).toContainText('Main idea');
    await expect(nodeLink).toContainText('Post');
    const bookNode = page.getByRole('button', {
      name: 'Feedback loops, from the book Engineering Feedback, Small loops',
    });
    await expect(bookNode).toBeVisible();
    await expect(bookNode).toContainText('Book');

    await nodeLink.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Scaling the Netflix API' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('January 2, 2026')).toBeVisible();
    for (let index = 0; index < 4; index += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
        true,
      );
    }
    const sourceLink = dialog.getByRole('link', { name: /go to netflix/i });
    await expect(sourceLink).toHaveAttribute('href', SOURCE_URL);

    const popup = await Promise.all([page.waitForEvent('popup'), sourceLink.click()]).then(
      ([openedPopup]) => openedPopup,
    );
    await popup.waitForLoadState();
    expect(popup.url()).toBe(SOURCE_URL);
    await popup.close();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(nodeLink).toBeFocused();
  });

  test('renders a concept without a source as a selectable, non-link button', async ({ page }) => {
    await page.goto('/ask');

    await page
      .getByRole('searchbox', { name: /ask a technical question/i })
      .fill('How does Netflix scale its API?');
    await page.getByRole('button', { name: /search/i }).click();
    await expect(page.getByText(/federated api gateway/i)).toBeVisible();

    await expect(page.getByRole('link', { name: /microservices/i })).toHaveCount(0);

    const conceptButton = page.getByRole('button', { name: /microservices, no linked source/i });
    await expect(conceptButton).toBeVisible();
    await conceptButton.focus();
    await expect(conceptButton).toBeFocused();
    await expect(conceptButton).toHaveClass(/bg-primary/);
  });

  test('supports zoom controls and graph replacement on a narrow viewport with reduced motion', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/ask');
    const search = page.getByRole('searchbox', { name: /ask a technical question/i });
    await search.fill('First graph');
    await page.getByRole('button', { name: /^search$/i }).click();
    const node = page.getByRole('button', {
      name: /api gateway, main idea, view article details/i,
    });
    await expect(node).toBeVisible();
    const group = page.getByRole('figure').locator('svg > g');
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(group).toHaveAttribute('transform', /scale\(1\.25\)/);
    await page.getByRole('button', { name: 'Reset view' }).click();
    await expect(group).toHaveAttribute('transform', /scale\(1\)/);
    await page.route('**/technical-queries', async (route) => {
      await route.fulfill({
        status: 201,
        headers: CORS_HEADERS,
        json: {
          ...RESPONSE,
          graph: {
            nodes: Array.from({ length: 7 }, (_, index) => ({
              id: `node-${index}`,
              label: `Concept ${index}`,
              type: 'concept',
              source: null,
            })),
            edges: [{ source: 'node-0', target: 'node-1', relationship: 'uses' }],
            centralNodeId: 'node-0',
          },
        },
      });
    });
    await search.fill('Second graph');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(node).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Concept 0, main idea, no linked source' }),
    ).toBeVisible();
    await expect(page.locator('.knowledge-graph button')).toHaveCount(7);
  });

  test('the query flow has no critical or serious accessibility violations', async ({ page }) => {
    await page.goto('/ask');

    await page
      .getByRole('searchbox', { name: /ask a technical question/i })
      .fill('How does Netflix scale its API?');
    await page.getByRole('button', { name: /search/i }).click();
    await expect(page.getByText(/federated api gateway/i)).toBeVisible();

    await expect(page.getByRole('button', { name: /view article details/i })).toBeVisible();
    await settleTransitions(page);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );

    expect(blocking).toEqual([]);
    await page.getByRole('button', { name: /view article details/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await settleTransitions(page);
    const modalResults = await new AxeBuilder({ page }).analyze();
    expect(
      modalResults.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious',
      ),
    ).toEqual([]);
  });
});
