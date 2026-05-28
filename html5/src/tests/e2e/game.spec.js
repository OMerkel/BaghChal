import { expect, test } from '@playwright/test';

const waitForClickableAction = page =>
  page.waitForFunction(
    () => {
      const overlays = document.querySelectorAll('#board svg circle');
      return [...overlays].some(el => el.style.cursor === 'pointer');
    },
    { timeout: 10_000 }
  );

const getSelectableOverlays = page =>
  page.evaluate(() => {
    const circles = [...document.querySelectorAll('#board svg circle')];
    return circles
      .filter(c => c.style.cursor === 'pointer')
      .map(c => ({
        cx: c.getAttribute('cx'),
        cy: c.getAttribute('cy'),
      }));
  });

const clickOverlayAt = async (page, cell) => {
  await page.evaluate(target => {
    const overlays = [...document.querySelectorAll('#board svg circle')].filter(
      c => c.style.cursor === 'pointer'
    );
    const hit = overlays.find(
      c => c.getAttribute('cx') === target.cx && c.getAttribute('cy') === target.cy
    );
    if (!hit) throw new Error('Selectable cell no longer available');
    hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, cell);
};

const getPieceFills = page =>
  page.evaluate(() => {
    const circles = [...document.querySelectorAll('#board svg circle')];
    return circles
      .map(c => c.getAttribute('fill'))
      .filter(fill => fill === '#b91c1c' || fill === '#f4d03f');
  });

const playFirstLegalMove = async page => {
  await waitForClickableAction(page);
  const sources = await getSelectableOverlays(page);
  if (sources.length === 0) throw new Error('No selectable source found');
  const source = sources[0];
  await clickOverlayAt(page, source);

  const destinations = await getSelectableOverlays(page);
  if (destinations.length === 0) throw new Error('No selectable destination found');
  await clickOverlayAt(page, destinations[0]);
};

test.describe('Page load', () => {
  test('title is correct', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Bagh Chal/i);
  });

  test('game view is visible on load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#view-game')).toBeVisible();
    await expect(page.locator('#view-rules')).toBeHidden();
    await expect(page.locator('#view-options')).toBeHidden();
    await expect(page.locator('#view-about')).toBeHidden();
  });

  test('header title shows default game variant', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app-header-title')).toHaveText('Bagh Chal');
  });

  test('header badge shows variant and defaults', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app-header-badge')).toContainText('Bagh Chal');
    await expect(page.locator('#app-header-badge')).toContainText('Goats human');
    await expect(page.locator('#app-header-badge')).toContainText('Tigers human');
  });

  test('board SVG is rendered', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#board svg')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('Rules link shows rules view', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-menu').click();
    await page.locator('#nav-rules').click();
    await expect(page.locator('#view-rules')).toBeVisible();
    await expect(page.locator('#view-game')).toBeHidden();
  });

  test('Options link shows options view', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-menu').click();
    await page.locator('#nav-options').click();
    await expect(page.locator('#view-options')).toBeVisible();
    await expect(page.locator('#view-game')).toBeHidden();
  });

  test('About link shows about view', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-menu').click();
    await page.locator('#nav-about').click();
    await expect(page.locator('#view-about')).toBeVisible();
    await expect(page.locator('#view-game')).toBeHidden();
  });

  test('Close in main navigation leaves subpage and returns to game', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-menu').click();
    await page.locator('#nav-rules').click();
    await expect(page.locator('#view-rules')).toBeVisible();

    await page.locator('#btn-menu').click();
    await page.locator('#btn-panel-close').click();

    await expect(page.locator('#view-game')).toBeVisible();
    await expect(page.locator('#view-rules')).toBeHidden();
  });

  test('Back button leaves subpage and returns to game', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-menu').click();
    await page.locator('#nav-rules').click();
    await expect(page.locator('#view-rules')).toBeVisible();

    await page.locator('#view-rules .btn-back').click();

    await expect(page.locator('#view-game')).toBeVisible();
    await expect(page.locator('#view-rules')).toBeHidden();
  });

  test('New Game from side panel returns to game view', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-menu').click();
    await page.locator('#nav-rules').click();
    await expect(page.locator('#view-rules')).toBeVisible();

    await page.locator('#btn-menu').click();
    await page.locator('#nav-new').click();

    await expect(page.locator('#view-game')).toBeVisible();
    await expect(page.locator('#view-rules')).toBeHidden();
  });
});

test.describe('Options', () => {
  test('game selector is not shown in options', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-menu').click();
    await page.locator('#nav-options').click();

    await expect(page.locator('input[name="gamevariant"]')).toHaveCount(0);
  });

  test('changing AI difficulty updates header badge', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-menu').click();
    await page.locator('#nav-options').click();

    await page.locator('input[name="firstplayer"][value="AI"]').check();
    await page.locator('input[name="difficultysouth"][value="Hard"]').check();
    await page.locator('#btn-options-ok').click();

    await expect(page.locator('#view-game')).toBeVisible();
    await expect(page.locator('#view-options')).toBeHidden();
    await expect(page.locator('#app-header-badge')).toContainText('Goats Hard');
  });

  test('manual profile override updates header badge', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-menu').click();
    await page.locator('#nav-options').click();

    await page.locator('input[name="deviceprofile"][value="Mobile"]').check();
    await page.locator('#btn-options-ok').click();

    await expect(page.locator('#app-header-badge')).toContainText('Mobile');
  });
});

test.describe('Board interaction', () => {
  test('human turn has selectable source cells', async ({ page }) => {
    await page.goto('/');
    await waitForClickableAction(page);

    const hasPointer = await page.evaluate(() => {
      const overlays = [...document.querySelectorAll('#board svg circle')];
      return overlays.some(r => r.style.cursor === 'pointer');
    });
    expect(hasPointer).toBe(true);
  });

  test('completing a legal move changes board state', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#board svg text').first()).toContainText('Goats to move');

    await playFirstLegalMove(page);
    await expect(page.locator('#board svg text').first()).toContainText('Tigers to move');
  });

  test('new game restores initial piece count', async ({ page }) => {
    await page.goto('/');
    await waitForClickableAction(page);

    await playFirstLegalMove(page);

    await page.locator('#btn-menu').click();
    await page.locator('#nav-new').click();

    await waitForClickableAction(page);
    const afterReset = await getPieceFills(page);
    expect(afterReset.length).toBe(4);
  });
});

test.describe('Accessibility', () => {
  test('header button has accessible label', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-menu')).toHaveAttribute('aria-label', /menu/i);
  });

  test('board SVG has an accessible label', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#board svg')).toHaveAttribute('aria-label', /Bagh Chal game board/i);
  });

  test('panel separators are rendered', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#side-panel .panel-divider')).toHaveCount(2);
  });
});
