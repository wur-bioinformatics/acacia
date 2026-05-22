import { describe, it, expect, beforeEach } from "vitest";
import { useQualityStore } from "./qualityStore";

const initial = useQualityStore.getState();

beforeEach(() => {
  useQualityStore.setState(initial);
});

describe("qualityStore", () => {
  it("starts idle with null arrays", () => {
    const s = useQualityStore.getState();
    expect(s.status).toBe("idle");
    expect(s.trident).toBeNull();
    expect(s.tcs).toBeNull();
    expect(s.isStale).toBe(false);
    expect(s.progress).toBeNull();
  });

  it("setRunning clears prior data and errors", () => {
    useQualityStore.setState({
      trident: [0.5],
      tcs: [[0.5]],
      tcsColMean: [0.5],
      tcsIdentifiers: ["seq1"],
      status: "done",
      error: "oops",
      isStale: true,
    });
    useQualityStore.getState().setRunning();
    const s = useQualityStore.getState();
    expect(s.status).toBe("running");
    expect(s.trident).toBeNull();
    expect(s.tcs).toBeNull();
    expect(s.tcsColMean).toBeNull();
    expect(s.tcsIdentifiers).toBeNull();
    expect(s.error).toBeNull();
    expect(s.isStale).toBe(false);
  });

  it("setProgress records stage/current/total", () => {
    useQualityStore.getState().setProgress("library", 5, 10);
    expect(useQualityStore.getState().progress).toEqual({
      stage: "library",
      current: 5,
      total: 10,
    });
  });

  it("setResult stores arrays and clears progress", () => {
    useQualityStore.getState().setRunning();
    useQualityStore.getState().setProgress("scoring", 4, 4);
    useQualityStore.getState().setResult([0.1], [[0.2]], [0.2], ["seq1"]);
    const s = useQualityStore.getState();
    expect(s.status).toBe("done");
    expect(s.trident).toEqual([0.1]);
    expect(s.tcs).toEqual([[0.2]]);
    expect(s.tcsColMean).toEqual([0.2]);
    expect(s.tcsIdentifiers).toEqual(["seq1"]);
    expect(s.progress).toBeNull();
  });

  it("setError transitions to error and clears progress", () => {
    useQualityStore.getState().setRunning();
    useQualityStore.getState().setError("boom");
    const s = useQualityStore.getState();
    expect(s.status).toBe("error");
    expect(s.error).toBe("boom");
    expect(s.progress).toBeNull();
  });

  it("markStale only sets isStale when status is done", () => {
    useQualityStore.getState().markStale();
    expect(useQualityStore.getState().isStale).toBe(false);

    useQualityStore.getState().setRunning();
    useQualityStore.getState().setResult([0.5], [[0.5]], [0.5], ["seq1"]);
    useQualityStore.getState().markStale();
    expect(useQualityStore.getState().isStale).toBe(true);
  });

  it("reset returns to initial state", () => {
    useQualityStore.getState().setRunning();
    useQualityStore.getState().setResult([1], [[1]], [1], ["seq1"]);
    useQualityStore.getState().markStale();
    useQualityStore.getState().reset();
    const s = useQualityStore.getState();
    expect(s.status).toBe("idle");
    expect(s.trident).toBeNull();
    expect(s.tcs).toBeNull();
    expect(s.tcsColMean).toBeNull();
    expect(s.tcsIdentifiers).toBeNull();
    expect(s.isStale).toBe(false);
    expect(s.progress).toBeNull();
  });
});
