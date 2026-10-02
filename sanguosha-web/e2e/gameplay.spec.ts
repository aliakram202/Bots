import { expect, test } from '@playwright/test';
import { createRoom, newPlayer } from './helpers';

test('normal rooms never expose debug tools', async ({ browser }) => {
  const host = await newPlayer(browser);
  await createRoom(host.page, 'Plain');
  await expect(host.page.getByText('Debug tools')).toHaveCount(0);
  // A forged debug message is refused by the server.
  const refused = await host.page.evaluate(async () => {
    return new Promise<string>((resolve) => {
      const code = location.pathname.split('/').pop()!;
      const s = JSON.parse(localStorage.getItem(`tkt:session:${code}`)!);
      const ws = new WebSocket(`ws://${location.host}/ws?room=${code}&token=${s.token}`);
      ws.onopen = () => ws.send(JSON.stringify({ t: 'debugState' }));
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.t === 'error') resolve(m.message);
      };
    });
  });
  expect(refused).toMatch(/disabled/);
});

test('Slash → target selection → no Dodge → dying → death → Rebels win (debug scenario)', async ({ browser, request }) => {
  const { page } = await newPlayer(browser);
  await page.goto('/');
  await page.getByTestId('name-input').fill('Ali');
  await page.getByText('Developer debug room').click();
  await page.getByTestId('create-room').click();
  const code = (await page.getByTestId('room-code').textContent())!.trim();
  for (const n of ['Bea', 'Cai']) await request.post(`/api/rooms/${code}/join`, { data: { name: n } });
  await page.getByText('Debug tools').click();
  await page.locator('.debug-panel select').selectOption('Dying rescue (Hua Tuo)');
  await page.getByText('Start scenario').click();
  await page.locator('.debug-panel').getByText('✕').click();

  // Zhang Fei (us) selects a Slash; valid targets light up.
  await page.locator('[data-testid=hand] [data-card=slash]').first().click();
  await expect(page.locator('.seat.targetable')).toHaveCount(2);
  await expect(page.getByTestId('confirm')).toBeDisabled();
  const lordSeat = page.locator('.seat', { hasText: 'Liu Bei' });
  await lordSeat.click();
  await expect(page.getByTestId('confirm')).toBeEnabled();
  await page.getByTestId('confirm').click();

  // Act as Liu Bei: the response prompt explains the situation.
  const actAs = page.locator('select').first();
  await actAs.selectOption({ label: 'Liu Bei (Bea)' });
  await expect(page.getByTestId('action-bar')).toContainText('used Slash against you');
  await page.getByTestId('cancel').click();

  // Dying: Hua Tuo may rescue with Jijiu (red card as Peach); decline.
  await actAs.selectOption({ label: 'Hua Tuo (Cai)' });
  await expect(page.getByTestId('action-bar')).toContainText('is dying');
  await page.getByTestId('cancel').click();

  await expect(page.getByTestId('game-over')).toBeVisible();
  await expect(page.getByTestId('game-over')).toContainText('Rebels');
  await expect(page.getByTestId('game-over')).toContainText('Lord 主公');
});
