import { useRef, useState } from "react";
import type { JSX } from "react";
import { useDrawStore } from "../stores/drawStore";

export default function SearchBar(): JSX.Element {
  const { drawOptions, setDrawOptions } = useDrawStore();
  const { highlightPattern, highlightUseRegex } = drawOptions;

  const [regexError, setRegexError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePatternChange = (value: string) => {
    if (highlightUseRegex && value) {
      try {
        new RegExp(value);
        setRegexError(false);
      } catch {
        setRegexError(true);
      }
    } else {
      setRegexError(false);
    }
    setDrawOptions({ highlightPattern: value });
  };

  const handleToggleRegex = () => {
    const next = !highlightUseRegex;
    if (next && highlightPattern) {
      try {
        new RegExp(highlightPattern);
        setRegexError(false);
      } catch {
        setRegexError(true);
      }
    } else {
      setRegexError(false);
    }
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
        className={`btn btn-xs font-mono ${highlightUseRegex ? "btn-primary" : "btn-ghost opacity-50"}`}
      >
        .*
      </button>
    </div>
  );
}
