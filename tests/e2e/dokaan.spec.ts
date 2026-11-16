import { test, expect } from '@playwright/test';

test.describe('দোকান সামলাও! (Dokaan Shamlao) Critical Player Journey E2E', () => {
  test('plays from Home without registration, completes Level 1, unlocks Level 2, retains progress on refresh, plays Daily Challenge, and verifies Leaderboard', async ({
    page,
  }) => {
    // 1. Open the game & start without registration
    await page.goto('/');
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('btn-main-play')).toContainText('খেলুন');
    await expect(page.getByTestId('hellokhata-home-link')).toBeVisible();

    // 2. Launch Level 1 from main Play button
    await page.getByTestId('btn-main-play').click();

    // 3. Complete tutorial intro modal and play Level 1
    const introModal = page.getByTestId('intro-modal');
    await expect(introModal).toBeVisible();
    await page.getByTestId('btn-start-level').click();
    await expect(introModal).toBeHidden();

    // Enable Auto-Assist so the reference bot plays through Level 1 deterministically
    await page.getByTestId('btn-auto-assist').click();

    // 4. Wait for Results screen and verify score & win
    const resultsScreen = page.getByTestId('results-screen');
    await expect(resultsScreen).toBeVisible({ timeout: 30_000 });
    const scoreText = await page.getByTestId('results-score').innerText();
    expect(scoreText.length).toBeGreaterThan(0);

    // Go to Level 2 then exit to Level Selection map and verify Level 2 is unlocked
    await page.getByTestId('btn-next-level').click();
    await expect(page.getByTestId('intro-modal')).toBeVisible();
    await page.getByTestId('btn-start-level').click();
    await page.getByTestId('btn-pause').click();
    await page.getByTestId('btn-exit-level').click();

    await expect(page.getByTestId('levels-screen')).toBeVisible();
    await expect(page.getByTestId('level-card-2')).toBeEnabled();

    // 5. Refresh the browser and confirm progress is retained
    await page.reload();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('btn-main-play')).toContainText('২');

    // 6. Open Daily Challenge and play/submit a score
    await page.getByTestId('home-btn-daily').click();
    await expect(page.getByTestId('daily-screen')).toBeVisible();
    await page.getByTestId('btn-play-daily').click();

    await expect(page.getByTestId('btn-auto-assist')).toBeVisible();
    // The daily config changes every day; some days open with a tutorial/boss intro that covers the HUD.
    const dailyStart = page.getByTestId('btn-start-level');
    if (await dailyStart.isVisible()) await dailyStart.click();
    await expect(page.getByTestId('intro-modal')).toBeHidden();
    await page.getByTestId('btn-auto-assist').click();
    await expect(page.getByTestId('results-screen')).toBeVisible({ timeout: 45_000 });
    await page.getByTestId('btn-results-menu').click();

    // 7. Confirm Leaderboard behavior
    await page.getByTestId('home-btn-leaderboard').click();
    await expect(page.getByTestId('leaderboard-screen')).toBeVisible();
    await expect(page.getByTestId('lb-row-1')).toBeVisible();
  });
});
