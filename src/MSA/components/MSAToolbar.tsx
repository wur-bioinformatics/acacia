import type { JSX } from "react";
import { useState, useEffect, useRef } from "react";
import AnalyseDropdown from "./AnalyseDropdown";
import ViewDropdown from "./ViewDropdown";
import { useNJWorker } from "../../NJ";

export default function MSAToolbar(): JSX.Element {
  const [openMenu, setOpenMenu] = useState<"analyse" | "view" | null>(null);
  const ref = useRef<HTMLUListElement>(null);
  const { runNJ } = useNJWorker();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggle(menu: "analyse" | "view") {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  }

  return (
    <ul ref={ref} className="menu menu-sm menu-horizontal bg-base-200 rounded-box z-20">
      <li className="relative">
        <button onClick={() => toggle("analyse")}>Analyse</button>
        {openMenu === "analyse" && <AnalyseDropdown onClose={() => setOpenMenu(null)} runNJ={runNJ} />}
      </li>
      <li className="relative">
        <button onClick={() => toggle("view")}>View</button>
        {openMenu === "view" && <ViewDropdown />}
      </li>
    </ul>
  );
}
