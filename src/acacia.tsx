import { create } from "zustand";
import MSA from "./MSA";
import React from "react";

const viewOptions = ["MSA", "Tree", "Tree + MSA"] as const;

type View = (typeof viewOptions)[number];

interface ViewState {
  view: View;
  setView: (view: View) => void;
}

const useViewStore = create<ViewState>((set) => ({
  view: "MSA",
  setView: (view: View) => set({ view }),
}));

function ViewDispatcher({ view }: { view: View }) {
  switch (view) {
    case "MSA":
      return <MSA />;
    case "Tree":
      return <div>Tree View (to be implemented)</div>;
    case "Tree + MSA":
      return <div>Tree + MSA View (to be implemented)</div>;
    default:
      return null;
  }
}

export default function Acacia() {
  const { view, setView } = useViewStore();
  return (
    <div className="mx-8 my-8">
      <div className="tabs tabs-lift">
        {viewOptions.map((viewOption) => (
          <React.Fragment key={viewOption}>
            <input
              type="radio"
              name="tabs"
              className="tab"
              aria-label={viewOption}
              checked={view === viewOption}
              onChange={() => setView(viewOption)}
            />
            <div className="tab-content bg-base-100 border-base-300 p-6">
              <ViewDispatcher view={viewOption} />
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
