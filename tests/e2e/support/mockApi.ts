import type { BrowserContext, Page, Route } from '@playwright/test';
import { getResponse } from 'msw';
import { resetMockDb } from '../../../src/mocks/db';
import { handlers } from '../../../src/mocks/handlers';

/**
 * Dev rejimidagi MSW handler'larini (`src/mocks`) Playwright'ga ulaydi (FE-02: mock'lar
 * dev va e2e uchun umumiy). Service worker ishlatilmaydi — u ushlagan so'rovni Playwright
 * ko'rmaydi (playwright.config: `serviceWorkers: 'block'`); handler'lar test jarayonida
 * `getResponse` bilan bajariladi. Mos handler bo'lmasa so'rov keyingi `page.route` ga o'tadi.
 *
 * Test o'z `page.route` ini keyinroq qo'shsa — u ustun (Playwright oxirgi qo'shilganini oldin
 * ishlatadi).
 */
async function fulfillFromMocks(route: Route): Promise<void> {
  const request = route.request();
  const headers = await request.allHeaders();
  const body = request.postDataBuffer();
  const mocked = await getResponse(
    handlers,
    new Request(request.url(), {
      method: request.method(),
      headers,
      body: body && !['GET', 'HEAD'].includes(request.method()) ? new Uint8Array(body) : undefined,
    }),
  );
  if (!mocked) {
    await route.fallback();
    return;
  }
  const responseHeaders: Record<string, string> = {};
  mocked.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  await route.fulfill({
    status: mocked.status,
    headers: responseHeaders,
    body: Buffer.from(await mocked.arrayBuffer()),
  });
}

/**
 * Butun kontekst (hamma tab) uchun — ikkinchi tab testlari shunga tayanadi. `reset: false` — ikkinchi
 * kontekst (boshqa rol, masalan admin tasdiqlagach sotuvchi katalogi) o'sha mock bazani ko'radi.
 */
export async function installMockApi(target: Page | BrowserContext, { reset = true }: { reset?: boolean } = {}): Promise<void> {
  if (reset) resetMockDb();
  await target.route('**/api/v1/**', fulfillFromMocks);
}
