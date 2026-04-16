import { useRef, useState } from "react";
import type { JSX } from "react";
import { useDrawStore } from "../stores/drawStore";

function isValidRegex(pattern: string): boolean {
  try { new RegExp(pattern); return true; }
  catch { return false; }
}

export default function SearchBar(): JSX.Element {
  const { drawOptions, setDrawOptions } = useDrawStore();
  const { highlightPattern, highlightUseRegex } = drawOptions;

  const [regexError, setRegexError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePatternChange = (value: string) => {
    setRegexError(highlightUseRegex && !!value && !isValidRegex(value));
    setDrawOptions({ highlightPattern: value });
  };

  const handleToggleRegex = () => {
    const next = !highlightUseRegex;
    setRegexError(next && !!highlightPattern && !isValidRegex(highlightPattern));
    setDrawOptions({ highlightUseRegex: next });
  };

  const handleClear = () => {
    setDrawOptions({ highlightPattern: "" });
    setRegexError(false);
    inputRef.current?.focus();
  };

  return (
    <div className="flex items-center gap-1">
      <label
        className={`input input-xs flex items-center gap-1 pr-1 ${regexError ? "input-error" : ""}`}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Find…"
          className="w-28"
          value={highlightPattern}
          onChange={(e) => handlePatternChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") handleClear();
          }}
          spellCheck={false}
        />
        {highlightPattern && (
          <button
            className="opacity-40 hover:opacity-80 text-xs leading-none"
            onClick={handleClear}
            tabIndex={-1}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </label>
      <button
        title={highlightUseRegex ? "Regex on" : "Regex off"}
        onClick={handleToggleRegex}
        className={`btn btn-xs font-mono ${highlightUseRegex ? "btn-primary" : "opacity-60"}`}
      >
        .*
      </button>
    </div>
  );
}
