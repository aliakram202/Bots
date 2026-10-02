import { expect, test } from '@playwright/test';
import { chooseGeneralIfAsked, createRoom, joinRoom, newPlayer } from './helpers';

type GameMsg = { t: 'game'; view: { viewer: string; lord: string | null; players: { id: string; hand?: number[]; role: string | null; handCount: number }[]; log: { text: string; private?: boolean }[] }; views?: unknown };

// CRITICAL: Player A must never receive Player B's hand cards or secret role over the network.
test('player A cannot discover player B\'s hand or role from network traffic', async ({ browser }) => {
  const A = await newPlayer(browser);
  const B = await newPlayer(browser);
  const code = await createRoom(A.page, 'Alice');
  await joinRoom(B.page, code, 'Bob');
  await B.page.getByTestId('ready').click();
  for (let i = 0; i < 3; i++) await A.page.getByTestId('add-bot').click();
  await A.page.getByTestId('start-game').click();
  await Promise.all([chooseGeneralIfAsked(A.page), chooseGeneralIfAsked(B.page)]);
  await expect(A.page.getByTestId('dashboard')).toBeVisible();
  await A.page.waitForTimeout(3000);

  const gameMsgs = (frames: unknown[]) => frames.filter((m): m is GameMsg => (m as GameMsg).t === 'game');
  const aMsgs = gameMsgs(A.frames.received);
  const bMsgs = gameMsgs(B.frames.received);
  expect(aMsgs.length).toBeGreaterThan(0);
  expect(bMsgs.length).toBeGreaterThan(0);
  const aId = aMsgs[0].view.viewer;
  const bId = bMsgs[0].view.viewer;
  expect(aId).not.toBe(bId);

  // What B privately knows: B's real hand and role.
  const bLast = bMsgs[bMsgs.length - 1].view.players.find((p) => p.id === bId)!;
  expect(bLast.hand).toBeDefined();
  expect(bLast.role).not.toBeNull();
  const aOwnPrivate = new Set(aMsgs.flatMap((m) => m.view.log.filter((e) => e.private).map((e) => e.text)));
  // Only texts that are genuinely B's secrets (A may coincidentally share the same role text).
  const bPrivateTexts = [...new Set(bMsgs.flatMap((m) => m.view.log.filter((e) => e.private).map((e) => e.text)))].filter((t) => !aOwnPrivate.has(t));
  expect(bPrivateTexts.some((t) => t.startsWith('Starting hand'))).toBe(true);

  for (const m of aMsgs) {
    expect(m.views).toBeUndefined(); // no all-seat debug views outside debug rooms
    const bInA = m.view.players.find((p) => p.id === bId)!;
    expect(bInA.hand).toBeUndefined();
    if (m.view.lord !== bId) expect(bInA.role).toBeNull();
    for (const p of m.view.players) if (p.id !== aId) expect(p.hand).toBeUndefined();
    for (const e of m.view.log) expect(bPrivateTexts).not.toContain(e.text);
  }
  // Nothing in A's raw traffic may mention B's secret role name next to B (e.g. "Your secret role").
  const raw = JSON.stringify(A.frames.received);
  const bRoleText = bPrivateTexts.find((t) => t.startsWith('Your secret role'));
  if (bRoleText) expect(raw).not.toContain(bRoleText);

  // The DOM of A also has no element exposing B's hand.
  await expect(A.page.locator(`[data-testid=seat-${bId}] [data-testid^=hand-]`)).toHaveCount(0);
});
