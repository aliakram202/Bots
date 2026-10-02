import type { Browser, BrowserContext, Page } from '@playwright/test';

export interface Frames {
  received: unknown[];
}

/** Record every WebSocket frame this page receives (parsed JSON). */
export function captureFrames(page: Page): Frames {
  const f: Frames = { received: [] };
  page.on('websocket', (ws) => {
    ws.on('framereceived', (ev) => {
      try {
        f.received.push(JSON.parse(String(ev.payload)));
      } catch {
        /* ignore */
      }
    });
  });
  return f;
}

export async function newPlayer(browser: Browser): Promise<{ ctx: BrowserContext; page: Page; frames: Frames }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const frames = captureFrames(page);
  return { ctx, page, frames };
}

export async function createRoom(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.getByTestId('name-input').fill(name);
  await page.getByTestId('create-room').click();
  const code = (await page.getByTestId('room-code').textContent())!.trim();
  return code;
}

export async function joinRoom(page: Page, code: string, name: string) {
  await page.goto(`/room/${code}`);
  await page.getByTestId('name-input').fill(name);
  await page.getByTestId('join-room').click();
  await page.getByTestId('room-code').waitFor();
}

/** Pick the first offered general whenever the selection dialog is open. */
export async function chooseGeneralIfAsked(page: Page) {
  const dlg = page.getByTestId('general-select');
  await dlg.waitFor({ timeout: 20_000 });
  await page.locator('[data-testid^=gen-]').first().click();
  await page.getByTestId('confirm-general').click();
  await dlg.waitFor({ state: 'detached' });
}
