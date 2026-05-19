import { test } from "./fixtures";

test.describe("Tree screenshots", () => {
  test("toolbar", async ({ treeReady }) => {
    const toolbar = treeReady.locator('[data-testid="tree-toolbar"]');
    await toolbar.screenshot({ path: "public/docs-assets/tree-toolbar.png" });
  });

  test("layouts", async ({ treeReady }) => {
    await treeReady.screenshot({ path: "public/docs-assets/tree-layouts.png" });
  });
});
