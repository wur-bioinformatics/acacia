import { describe, it, expect, beforeEach } from "vitest";
import { useQualityStore } from "./qualityStore";

const initial = useQualityStore.getState();

beforeEach(() => {
  useQualityStore.setState(initial);
});

describe("qualityStore", () => {
  it("starts idle with null arrays", () => {
    const s = useQualityStore.getState();
    expect(s.tridentStatus).toBe("idle");
    expect(s.tcsStatus).toBe("idle");
    expect(s.trident).toBeNull();
    expect(s.tcs).toBeNull();
    expect(s.tridentStale).toBe(false);
    expect(s.tcsStale).toBe(false);
    expect(s.tcsProgress).toBeNull();
  });

  it("setTridentRunning clears prior trident data and error", () => {
    useQualityStore.setState({
      trident: [0.5],
      tridentStatus: "done",
      tridentError: "oops",
      tridentStale: true,
    });
    useQualityStore.getState().setTridentRunning();
    const s = useQualityStore.getState();
    expect(s.tridentStatus).toBe("running");
    expect(s.trident).toBeNull();
    expect(s.tridentError).toBeNull();
    expect(s.tridentStale).toBe(false);
  });

  it("setTridentResult stores the array and marks done", () => {
    useQualityStore.getState().setTridentRunning();
    useQualityStore.getState().setTridentResult([0.1, 0.9]);
    const s = useQualityStore.getState();
    expect(s.tridentStatus).toBe("done");
    expect(s.trident).toEqual([0.1, 0.9]);
  });

  it("setTcsRunning clears prior tcs data and progress", () => {
    useQualityStore.setState({
      tcs: [[0.5]],
      tcsColMean: [0.5],
      tcsIdentifiers: ["seq1"],
      tcsStatus: "done",
      tcsError: "oops",
      tcsStale: true,
      tcsProgress: { stage: "scoring", current: 1, total: 1 },
    });
    useQualityStore.getState().setTcsRunning();
    const s = useQualityStore.getState();
    expect(s.tcsStatus).toBe("running");
    expect(s.tcs).toBeNull();
    expect(s.tcsColMean).toBeNull();
    expect(s.tcsIdentifiers).toBeNull();
    expect(s.tcsError).toBeNull();
    expect(s.tcsStale).toBe(false);
    expect(s.tcsProgress).toBeNull();
  });

  it("setTcsProgress records stage/current/total", () => {
    useQualityStore.getState().setTcsProgress("library", 5, 10);
    expect(useQualityStore.getState().tcsProgress).toEqual({
      stage: "library",
      current: 5,
      total: 10,
    });
  });

  it("setTcsResult stores arrays and clears progress", () => {
    useQualityStore.getState().setTcsRunning();
    useQualityStore.getState().setTcsProgress("scoring", 4, 4);
    useQualityStore.getState().setTcsResult([[0.2]], [0.2], ["seq1"]);
    const s = useQualityStore.getState();
    expect(s.tcsStatus).toBe("done");
    expect(s.tcs).toEqual([[0.2]]);
    expect(s.tcsColMean).toEqual([0.2]);
    expect(s.tcsIdentifiers).toEqual(["seq1"]);
    expect(s.tcsProgress).toBeNull();
  });

  it("setError transitions each metric to error and clears tcs progress", () => {
    useQualityStore.getState().setTridentRunning();
    useQualityStore.getState().setTridentError("boom");
    expect(useQualityStore.getState().tridentStatus).toBe("error");
    expect(useQualityStore.getState().tridentError).toBe("boom");

    useQualityStore.getState().setTcsRunning();
    useQualityStore.getState().setTcsProgress("library", 1, 2);
    useQualityStore.getState().setTcsError("bang");
    expect(useQualityStore.getState().tcsStatus).toBe("error");
    expect(useQualityStore.getState().tcsError).toBe("bang");
    expect(useQualityStore.getState().tcsProgress).toBeNull();
  });

  it("markStale only sets staleness for metrics that are done", () => {
    useQualityStore.getState().markStale();
    expect(useQualityStore.getState().tridentStale).toBe(false);
    expect(useQualityStore.getState().tcsStale).toBe(false);

    useQualityStore.getState().setTridentRunning();
    useQualityStore.getState().setTridentResult([0.5]);
    useQualityStore.getState().markStale();
    expect(useQualityStore.getState().tridentStale).toBe(true);
    // TCS never completed, so it does not become stale.
    expect(useQualityStore.getState().tcsStale).toBe(false);
  });

  it("reset returns to initial state", () => {
    useQualityStore.getState().setTridentRunning();
    useQualityStore.getState().setTridentResult([1]);
    useQualityStore.getState().setTcsRunning();
    useQualityStore.getState().setTcsResult([[1]], [1], ["seq1"]);
    useQualityStore.getState().markStale();
    useQualityStore.getState().reset();
    const s = useQualityStore.getState();
    expect(s.tridentStatus).toBe("idle");
    expect(s.tcsStatus).toBe("idle");
    expect(s.trident).toBeNull();
    expect(s.tcs).toBeNull();
    expect(s.tcsColMean).toBeNull();
    expect(s.tcsIdentifiers).toBeNull();
    expect(s.tridentStale).toBe(false);
    expect(s.tcsStale).toBe(false);
    expect(s.tcsProgress).toBeNull();
  });
});
