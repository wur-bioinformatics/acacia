import MSA from "./MSA";
import Tree from "./tree";
import { DistanceMatrix } from "./NJ";
import React, { JSX } from "react";
import { AcaciaBrand } from "./AcaciaLogo";
import { viewOptions, useViewStore, type View } from "./viewStore";
import { useNJStore } from "./NJ/njStore";
import { version } from "../package.json";

function ViewDispatcher({ view }: { view: View }): JSX.Element | null {
  switch (view) {
    case "MSA":
      return <MSA />;
    case "Tree":
      return <Tree />;
    case "Tree + MSA":
      return <div>Tree + MSA View (to be implemented)</div>;
    case "Distances":
      return <DistanceMatrix />;
    default:
      return null;
  }
}

export default function Acacia(): JSX.Element {
  const { view, setView } = useViewStore();
  const { status: njStatus } = useNJStore();
  const treeReady = njStatus === "done";

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 max-w-screen mx-auto w-full px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
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
              <div className="tab-content bg-base-100 border-base-300 p-3 sm:p-4 md:p-6">
                <ViewDispatcher view={viewOption} />
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
      <footer className="footer footer-horizontal bg-base-200 text-base-content border-t border-base-300 items-center px-6 py-3">
        <aside className="flex items-center gap-2 opacity-60">
          <AcaciaBrand size={18} />
          <span className="text-xs">v{version}</span>
        </aside>
        <nav className="ml-auto">
          <a
            href="https://github.com/wur-bioinformatics/acacia"
            target="_blank"
            rel="noreferrer"
            className="opacity-50 hover:opacity-100 transition-opacity"
            aria-label="GitHub repository"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </nav>
      </footer>
    </div>
  );
}
