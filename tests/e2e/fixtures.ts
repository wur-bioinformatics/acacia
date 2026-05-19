import { test as base, type Page, expect } from "@playwright/test";

type Fixtures = {
  msaLoaded: Page;
  treeReady: Page;
};

export const test = base.extend<Fixtures>({
  msaLoaded: async ({ page }, use) => {
    await page.goto("/");
    await page.getByRole("button", { name: /load example data/i }).click();
    await expect(page.locator('[data-testid="msa-toolbar"]')).toBeVisible({ timeout: 15_000 });
    await use(page);
  },

  treeReady: async ({ msaLoaded }, use) => {
    const page = msaLoaded;
    await page.getByRole("button", { name: "Analyse" }).click();
    await page.getByRole("button", { name: /^run$/i }).click();
    await expect(page.locator('[data-testid="tree-rendered"]')).toBeVisible({ timeout: 30_000 });
    await use(page);
  },
});

export { expect };
