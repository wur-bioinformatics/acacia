import { describe, it, expect, beforeEach } from "vitest";
import { useNJStore } from "./njStore";

const initialState = {
  newick: null,
  distanceMatrix: null,
  avgDistance: null,
  status: "idle" as const,
  error: null,
  progress: null,
  njParams: null,
};

beforeEach(() => {
  useNJStore.setState(initialState);
});

describe("njStore setRunning", () => {
  it("sets status to running", () => {
    useNJStore.getState().setRunning();
    expect(useNJStore.getState().status).toBe("running");
  });

  it("clears newick, distanceMatrix, avgDistance, error and progress", () => {
    useNJStore.setState({
      newick: "(A,B);",
      error: "previous error",
      progress: { current: 5, total: 10 },
    });
    useNJStore.getState().setRunning();
    const s = useNJStore.getState();
    expect(s.newick).toBeNull();
    expect(s.distanceMatrix).toBeNull();
    expect(s.avgDistance).toBeNull();
    expect(s.error).toBeNull();
    expect(s.progress).toBeNull();
  });
});

describe("njStore setResult", () => {
  const fakeMatrix = { names: ["A", "B"], matrix: [[0, 1], [1, 0]] };
  const fakeParams = { substitution_model: "JC", n_bootstrap_samples: 0 };

  it("stores result and sets status to done", () => {
    useNJStore.getState().setResult("(A,B);", fakeMatrix, 0.5, fakeParams);
    const s = useNJStore.getState();
    expect(s.newick).toBe("(A,B);");
    expect(s.distanceMatrix).toBe(fakeMatrix);
    expect(s.avgDistance).toBe(0.5);
    expect(s.status).toBe("done");
    expect(s.njParams).toEqual(fakeParams);
  });

  it("clears progress on result", () => {
    useNJStore.setState({ progress: { current: 3, total: 10 } });
    useNJStore.getState().setResult("(A,B);", fakeMatrix, 0.5, fakeParams);
    expect(useNJStore.getState().progress).toBeNull();
  });
});

describe("njStore setError", () => {
  it("sets error message and status to error", () => {
    useNJStore.getState().setError("something went wrong");
    const s = useNJStore.getState();
    expect(s.error).toBe("something went wrong");
    expect(s.status).toBe("error");
  });

  it("clears progress on error", () => {
    useNJStore.setState({ progress: { current: 2, total: 10 } });
    useNJStore.getState().setError("fail");
    expect(useNJStore.getState().progress).toBeNull();
  });

  it("does not affect newick or distanceMatrix", () => {
    const fakeMatrix = { names: ["A"], matrix: [[0]] };
    useNJStore.setState({ newick: "(A);", distanceMatrix: fakeMatrix });
    useNJStore.getState().setError("fail");
    const s = useNJStore.getState();
    expect(s.newick).toBe("(A);");
    expect(s.distanceMatrix).toBe(fakeMatrix);
  });
});

describe("njStore setProgress", () => {
  it("updates progress with current and total", () => {
    useNJStore.getState().setProgress(3, 10);
    expect(useNJStore.getState().progress).toEqual({ current: 3, total: 10 });
  });

  it("can update progress multiple times", () => {
    useNJStore.getState().setProgress(1, 10);
    useNJStore.getState().setProgress(5, 10);
    expect(useNJStore.getState().progress).toEqual({ current: 5, total: 10 });
  });

  it("does not affect status", () => {
    useNJStore.getState().setProgress(1, 10);
    expect(useNJStore.getState().status).toBe("idle");
  });
});
