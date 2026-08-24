import { describe, it, expect, beforeEach } from "vitest";
import { useViewStore, viewOptions } from "./viewStore";

beforeEach(() => {
  useViewStore.setState({ view: "MSA" });
});

describe("viewStore", () => {
  it("starts with view MSA", () => {
    expect(useViewStore.getState().view).toBe("MSA");
  });

  it("setView updates to Tree", () => {
    useViewStore.getState().setView("Tree");
    expect(useViewStore.getState().view).toBe("Tree");
  });

  it("setView updates to Distances", () => {
    useViewStore.getState().setView("Distances");
    expect(useViewStore.getState().view).toBe("Distances");
  });

  it("exposes the views in pipeline order", () => {
    expect(viewOptions).toEqual(["MSA", "Distances", "Tree"]);
  });

  it("setView can switch back to MSA", () => {
    useViewStore.getState().setView("Tree");
    useViewStore.getState().setView("MSA");
    expect(useViewStore.getState().view).toBe("MSA");
  });
});
