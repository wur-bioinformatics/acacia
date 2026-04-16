import type { JSX } from "react";
import AnalyseDropdown from "./AnalyseDropdown";
import ViewDropdown from "./ViewDropdown";
import SearchBar from "./SearchBar";
import { useDrawStore } from "../stores/drawStore";

export default function MSAToolbar(): JSX.Element {
  const { interactionMode, setInteractionMode } = useDrawStore();

  return (
    <>
      <div className="flex items-center gap-2 bg-base-200 rounded-box px-1">
        <ul className="menu menu-sm menu-horizontal">
          <li>
            <button
              popoverTarget="msa-analyse-menu"
              style={{ anchorName: "--msa-analyse-menu" }}
            >
              Analyse
            </button>
          </li>
          <li>
            <button
              popoverTarget="msa-view-menu"
              style={{ anchorName: "--msa-view-menu" }}
            >
              View
            </button>
          </li>
        </ul>

        {/* Interaction mode toggle */}
        <div className="join" title="Interaction mode">
          <button
            className={`join-item btn btn-xs${interactionMode === "pointer" ? " btn-primary" : ""}`}
            onClick={() => setInteractionMode("pointer")}
            title="Pointer — hover to highlight row & column"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 3l14 9-7 1-4 7L5 3z" />
            </svg>
          </button>
          <button
            className={`join-item btn btn-xs${interactionMode === "hand" ? " btn-primary" : ""}`}
            onClick={() => setInteractionMode("hand")}
            title="Hand — drag to pan"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 11V6a2 2 0 0 0-4 0v5" />
              <path d="M14 10V4a2 2 0 0 0-4 0v6" />
              <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L8 15" />
            </svg>
          </button>
        </div>

        <SearchBar />
      </div>
      <AnalyseDropdown id="msa-analyse-menu" />
      <ViewDropdown id="msa-view-menu" />
    </>
  );
}
