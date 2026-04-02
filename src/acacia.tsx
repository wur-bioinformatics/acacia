import MSA from "./MSA";
import Tree from "./tree";
import React, { JSX } from "react";
import { viewOptions, useViewStore, type View } from "./viewStore";
import { useNJStore } from "./NJ/njStore";

function ViewDispatcher({ view }: { view: View }): JSX.Element | null {
  switch (view) {
    case "MSA":
      return <MSA />;
    case "Tree":
      return <Tree />;
    case "Tree + MSA":
      return <div>Tree + MSA View (to be implemented)</div>;
    default:
      return null;
  }
}

export default function Acacia(): JSX.Element {
  const { view, setView } = useViewStore();
  const { status: njStatus } = useNJStore();
  const treeReady = njStatus === "done";

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
              disabled={viewOption !== "MSA" && !treeReady}
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
