import { expect, test } from '@playwright/test';
import { chooseGeneralIfAsked, createRoom, joinRoom, newPlayer } from './helpers';

test('host creates a room, a friend joins by link, bots fill seats, game starts for both', async ({ browser }) => {
  const host = await newPlayer(browser);
  const guest = await newPlayer(browser);
  const code = await createRoom(host.page, 'Host');
  await expect(host.page.getByTestId('invite-link')).toHaveValue(new RegExp(`/room/${code}$`));

  await joinRoom(guest.page, code, 'Guest');
  await expect(host.page.getByTestId('member-Guest')).toBeVisible();
  await expect(guest.page.getByTestId('member-Host')).toBeVisible();

  // Host cannot start until the guest is ready.
  for (let i = 0; i < 3; i++) await host.page.getByTestId('add-bot').click();
  await expect(host.page.getByTestId('start-game')).toBeDisabled();
  await guest.page.getByTestId('ready').click();
  await expect(host.page.getByTestId('start-game')).toBeEnabled();

  // Chat works across contexts.
  await guest.page.getByTestId('chat-input').fill('hello table');
  await guest.page.getByTestId('chat-input').press('Enter');
  await expect(host.page.getByText('hello table')).toBeVisible();

  await host.page.getByTestId('start-game').click();
  // Both humans eventually choose a general (Lord first, then everyone else).
  await Promise.all([chooseGeneralIfAsked(host.page), chooseGeneralIfAsked(guest.page)]);
  await expect(host.page.getByTestId('battlefield')).toBeVisible();
  await expect(guest.page.getByTestId('battlefield')).toBeVisible();
  await expect(host.page.getByTestId('dashboard')).toBeVisible();
  await expect(host.page.locator('[data-testid^=seat-]')).toHaveCount(4);
});

test('a player who reloads reconnects to the same seat and private state', async ({ browser }) => {
  const host = await newPlayer(browser);
  await createRoom(host.page, 'Solo');
  for (let i = 0; i < 4; i++) await host.page.getByTestId('add-bot').click();
  await host.page.getByTestId('start-game').click();
  await chooseGeneralIfAsked(host.page);
  await expect(host.page.getByTestId('dashboard')).toBeVisible();
  const meName = host.page.locator('.me-name');
  await expect(meName).not.toHaveText(/^\s*Solo/); // general assigned
  const before = await meName.textContent();
  const role = await host.page.getByTestId('me-card').locator('.role-badge').textContent();
  await host.page.reload();
  await expect(host.page.getByTestId('dashboard')).toBeVisible();
  await expect(meName).toHaveText(before!);
  await expect(host.page.getByTestId('me-card').locator('.role-badge')).toHaveText(role!);
});

test('rules drawer is searchable and shows sources', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Rules & About').click();
  await page.getByPlaceholder(/Search rules/).fill('lightning');
  await expect(page.getByTestId('rulebook').getByText(/♠2–♠9/).first()).toBeVisible();
  await page.getByText('Card encyclopedia').click();
  await expect(page.getByTestId('rulebook').locator('a[href^="http"]').first()).toBeVisible();
});
