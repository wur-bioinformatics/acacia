import { describe, it, expect, beforeEach } from "vitest";
import { useSequenceStore } from "./sequenceStore";

beforeEach(() => {
  useSequenceStore.setState({ order: [], selectedIdentifier: null });
});

describe("sequenceStore setOrder", () => {
  it("replaces the order array", () => {
    useSequenceStore.getState().setOrder(["a", "b", "c"]);
    expect(useSequenceStore.getState().order).toEqual(["a", "b", "c"]);
  });

  it("overwrites a previous order", () => {
    useSequenceStore.getState().setOrder(["a", "b"]);
    useSequenceStore.getState().setOrder(["x", "y", "z"]);
    expect(useSequenceStore.getState().order).toEqual(["x", "y", "z"]);
  });
});

describe("sequenceStore moveSequence", () => {
  beforeEach(() => {
    useSequenceStore.getState().setOrder(["a", "b", "c", "d"]);
  });

  it("moves an item forward", () => {
    useSequenceStore.getState().moveSequence(0, 2);
    expect(useSequenceStore.getState().order).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an item backward", () => {
    useSequenceStore.getState().moveSequence(3, 1);
    expect(useSequenceStore.getState().order).toEqual(["a", "d", "b", "c"]);
  });

  it("moving to the same index leaves order unchanged", () => {
    useSequenceStore.getState().moveSequence(1, 1);
    expect(useSequenceStore.getState().order).toEqual(["a", "b", "c", "d"]);
  });

  it("moves first to last", () => {
    useSequenceStore.getState().moveSequence(0, 3);
    expect(useSequenceStore.getState().order).toEqual(["b", "c", "d", "a"]);
  });

  it("moves last to first", () => {
    useSequenceStore.getState().moveSequence(3, 0);
    expect(useSequenceStore.getState().order).toEqual(["d", "a", "b", "c"]);
  });
});

describe("sequenceStore syncFromTreeLeafOrder", () => {
  it("reorders to match tree leaf order", () => {
    useSequenceStore.getState().setOrder(["a", "b", "c"]);
    useSequenceStore.getState().syncFromTreeLeafOrder(["c", "a", "b"]);
    expect(useSequenceStore.getState().order).toEqual(["c", "a", "b"]);
  });

  it("appends identifiers not present in the tree at the end", () => {
    useSequenceStore.getState().setOrder(["a", "b", "c", "extra"]);
    useSequenceStore.getState().syncFromTreeLeafOrder(["c", "a", "b"]);
    expect(useSequenceStore.getState().order).toEqual(["c", "a", "b", "extra"]);
  });

  it("handles empty leaf order (all become extras)", () => {
    useSequenceStore.getState().setOrder(["a", "b"]);
    useSequenceStore.getState().syncFromTreeLeafOrder([]);
    expect(useSequenceStore.getState().order).toEqual(["a", "b"]);
  });
});

describe("sequenceStore setSelectedIdentifier", () => {
  it("sets the selected identifier", () => {
    useSequenceStore.getState().setSelectedIdentifier("seq1");
    expect(useSequenceStore.getState().selectedIdentifier).toBe("seq1");
  });

  it("can be cleared to null", () => {
    useSequenceStore.getState().setSelectedIdentifier("seq1");
    useSequenceStore.getState().setSelectedIdentifier(null);
    expect(useSequenceStore.getState().selectedIdentifier).toBeNull();
  });

  it("does not affect order", () => {
    useSequenceStore.getState().setOrder(["a", "b"]);
    useSequenceStore.getState().setSelectedIdentifier("a");
    expect(useSequenceStore.getState().order).toEqual(["a", "b"]);
  });
});
