import { test } from "./fixtures";

test.describe("MSA screenshots", () => {
  test("overview", async ({ msaLoaded }) => {
    await msaLoaded.screenshot({ path: "public/docs-assets/msa-overview.png" });
  });

  test("toolbar", async ({ msaLoaded }) => {
    const toolbar = msaLoaded.locator('[data-testid="msa-toolbar"]');
    await toolbar.screenshot({ path: "public/docs-assets/msa-toolbar.png" });
  });
});
