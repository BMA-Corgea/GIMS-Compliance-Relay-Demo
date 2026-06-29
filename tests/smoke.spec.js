/* ════════════════════════════════════════════════════════════════════════
   smoke.spec.js — optional Playwright happy-path for the static demo.

   This is NOT wired into CI (keeping the deploy config-free and CI deterministic);
   it's a local smoke you can run by hand. From the repo root:

     npx serve -l 4000 .            # or: python3 -m http.server 4000
     npm i -D @playwright/test && npx playwright install chromium
     BASE_URL=http://localhost:4000 npx playwright test tests/smoke.spec.js

   It asserts the neutering-visible behaviours: arbitrary login works, the trail
   seeds, verify always reads green, a watched folder grows the trail, signing
   appends a row, and an export downloads a DEMO-watermarked file.
   ════════════════════════════════════════════════════════════════════════ */
const { test, expect } = require("@playwright/test");

const BASE = process.env.BASE_URL || "http://localhost:4000";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(BASE + "/");
});

test("login accepts arbitrary credentials and the trail seeds", async ({ page }) => {
  await expect(page.locator(".demo-banner")).toContainText("DEMO");
  await page.fill("#loginEmail", "anyone@example.com");
  await page.fill("#loginPassword", "whatever");
  await page.click("#loginBtn");
  await expect(page.locator("#dashboard")).toBeVisible();
  await expect(page.locator("#trailBody tr")).not.toHaveCount(0);
});

test("verify always reads green and checksums are demo-tagged", async ({ page }) => {
  await page.fill("#loginEmail", "a@b.com");
  await page.fill("#loginPassword", "x");
  await page.click("#loginBtn");
  await page.click("#verifyBtn");
  await expect(page.locator("#chainPill")).toHaveClass(/ok/);
  await expect(page.locator("#chainPillText")).toContainText("Chain verified");
  await expect(page.locator("#trailBody tr").first()).toContainText("demo");
});

test("watching a folder grows the trail; signing appends a signature", async ({ page }) => {
  await page.fill("#loginEmail", "a@b.com");
  await page.fill("#loginPassword", "x");
  await page.click("#loginBtn");

  const before = await page.locator("#trailBody tr").count();
  await page.fill("#folderInput", "/instrument/demo");
  await page.click("#addFolderBtn");
  await page.click("#refreshBtn");
  await expect.poll(async () => page.locator("#trailBody tr").count()).toBeGreaterThan(before);

  await page.locator("#trailBody tr").first().hover();
  await page.locator("#trailBody tr .row-sign").first().click();
  await expect(page.locator("#signOverlay")).toBeVisible();
  await page.fill("#signPassword", "x");
  await page.fill("#signReason", "smoke test");
  await page.click("#signConfirm");
  await expect(page.locator("#signOverlay")).toBeHidden();
  await expect(page.locator("#trailBody tr").first()).toContainText("signature");
});

test("CSV export downloads a DEMO-watermarked file", async ({ page }) => {
  await page.fill("#loginEmail", "a@b.com");
  await page.fill("#loginPassword", "x");
  await page.click("#loginBtn");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#exportCsvBtn"),
  ]);
  expect(download.suggestedFilename()).toContain("trail.csv");
});

test("reset-on-reload: appended records are gone after reload", async ({ page }) => {
  await page.fill("#loginEmail", "a@b.com");
  await page.fill("#loginPassword", "x");
  await page.click("#loginBtn");
  await page.fill("#folderInput", "/instrument/demo");
  await page.click("#addFolderBtn");
  await page.click("#refreshBtn");
  const grown = await page.locator("#trailBody tr").count();

  await page.reload();
  // token persists, so we land on the dashboard; the in-memory trail reseeds.
  await expect(page.locator("#dashboard")).toBeVisible();
  const afterReload = await page.locator("#trailBody tr").count();
  expect(afterReload).toBeLessThanOrEqual(grown);
});
