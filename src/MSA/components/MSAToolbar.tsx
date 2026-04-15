import type { JSX } from "react";
import AnalyseDropdown from "./AnalyseDropdown";
import ViewDropdown from "./ViewDropdown";
import SearchBar from "./SearchBar";
import { useNJWorker } from "../../NJ";

export default function MSAToolbar(): JSX.Element {
  const { runNJ } = useNJWorker();

  return (
    <>
      <div className="flex items-center gap-2 bg-base-200 rounded-box px-1">
        <ul className="menu menu-sm menu-horizontal">
          <li>
            <button popoverTarget="msa-analyse-menu" style={{ anchorName: "--msa-analyse-menu" }}>
              Analyse
            </button>
          </li>
          <li>
            <button popoverTarget="msa-view-menu" style={{ anchorName: "--msa-view-menu" }}>
              View
            </button>
          </li>
        </ul>
        <SearchBar />
      </div>
      <AnalyseDropdown id="msa-analyse-menu" runNJ={runNJ} />
      <ViewDropdown id="msa-view-menu" />
    </>
  );
}
