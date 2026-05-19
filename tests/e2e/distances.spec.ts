import { test } from "./fixtures";

test.describe("Distances screenshots", () => {
  test("overview", async ({ treeReady }) => {
    await treeReady.getByRole("tab", { name: "Distances" }).click();
    await treeReady.screenshot({ path: "public/docs-assets/distances-overview.png" });
  });
});
