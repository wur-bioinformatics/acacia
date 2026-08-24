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
  distanceStatus: "idle" as const,
  distanceError: null,
  distanceParams: null,
  distanceStale: false,
  isStale: false,
};

const fakeMatrix = { names: ["A", "B"], matrix: [[0, 1], [1, 0]] };
const fakeParams = {
  substitution_model: "JukesCantor" as const,
  n_bootstrap_samples: 0,
  gamma_shape: null,
  p_invar: null,
};

beforeEach(() => {
  useNJStore.setState(initialState);
});

describe("njStore setRunning", () => {
  it("sets status to running", () => {
    useNJStore.getState().setRunning();
    expect(useNJStore.getState().status).toBe("running");
  });

  it("clears newick, error and progress", () => {
    useNJStore.setState({
      newick: "(A,B);",
      error: "previous error",
      progress: { current: 5, total: 10 },
    });
    useNJStore.getState().setRunning();
    const s = useNJStore.getState();
    expect(s.newick).toBeNull();
    expect(s.error).toBeNull();
    expect(s.progress).toBeNull();
  });

  it("keeps existing distances on screen until the new ones land", () => {
    useNJStore.setState({ distanceMatrix: fakeMatrix, avgDistance: 0.5, distanceStatus: "done" });
    useNJStore.getState().setRunning();
    const s = useNJStore.getState();
    expect(s.distanceMatrix).toBe(fakeMatrix);
    expect(s.avgDistance).toBe(0.5);
  });
});

describe("njStore setResult", () => {
  it("stores result and sets status to done", () => {
    useNJStore.getState().setResult("(A,B);", fakeMatrix, 0.5, fakeParams);
    const s = useNJStore.getState();
    expect(s.newick).toBe("(A,B);");
    expect(s.distanceMatrix).toBe(fakeMatrix);
    expect(s.avgDistance).toBe(0.5);
    expect(s.status).toBe("done");
    expect(s.njParams).toEqual(fakeParams);
  });

  it("also publishes the distances the run produced", () => {
    useNJStore.getState().setResult("(A,B);", fakeMatrix, 0.5, fakeParams);
    const s = useNJStore.getState();
    expect(s.distanceStatus).toBe("done");
    expect(s.distanceMatrix).toBe(fakeMatrix);
    expect(s.distanceParams).toEqual({
      substitution_model: "JukesCantor",
      gamma_shape: null,
      p_invar: null,
    });
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

describe("njStore distance-only runs", () => {
  const distanceParams = { substitution_model: "PDiff" as const, gamma_shape: null, p_invar: null };

  it("setDistanceRunning clears the previous matrix and error", () => {
    useNJStore.setState({
      distanceMatrix: fakeMatrix,
      avgDistance: 0.5,
      distanceError: "previous error",
      distanceStale: true,
    });
    useNJStore.getState().setDistanceRunning();
    const s = useNJStore.getState();
    expect(s.distanceStatus).toBe("running");
    expect(s.distanceMatrix).toBeNull();
    expect(s.avgDistance).toBeNull();
    expect(s.distanceError).toBeNull();
    expect(s.distanceStale).toBe(false);
  });

  it("setDistanceResult stores the matrix without touching the tree", () => {
    useNJStore.setState({ newick: "(A,B);", status: "done" });
    useNJStore.getState().setDistanceResult(fakeMatrix, 0.5, distanceParams);
    const s = useNJStore.getState();
    expect(s.distanceMatrix).toBe(fakeMatrix);
    expect(s.avgDistance).toBe(0.5);
    expect(s.distanceStatus).toBe("done");
    expect(s.distanceParams).toEqual(distanceParams);
    expect(s.newick).toBe("(A,B);");
    expect(s.status).toBe("done");
  });

  it("setDistanceError records the error", () => {
    useNJStore.getState().setDistanceError("nope");
    const s = useNJStore.getState();
    expect(s.distanceStatus).toBe("error");
    expect(s.distanceError).toBe("nope");
  });
});

describe("njStore markStale", () => {
  it("marks only the results that exist", () => {
    useNJStore.setState({ distanceStatus: "done", status: "idle" });
    useNJStore.getState().markStale();
    let s = useNJStore.getState();
    expect(s.distanceStale).toBe(true);
    expect(s.isStale).toBe(false);

    useNJStore.setState({ status: "done" });
    useNJStore.getState().markStale();
    s = useNJStore.getState();
    expect(s.isStale).toBe(true);
  });
});
