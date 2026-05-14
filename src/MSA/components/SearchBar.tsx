import type { JSX } from "react";
import { useDrawStore } from "../stores/drawStore";
import SearchInput from "@/components/SearchInput";

export default function SearchBar(): JSX.Element {
  const { drawOptions, setDrawOptions } = useDrawStore();
  const { highlightPattern, highlightUseRegex } = drawOptions;

  return (
    <SearchInput
      value={highlightPattern}
      onValueChange={(v) => setDrawOptions({ highlightPattern: v })}
      useRegex={highlightUseRegex}
      onToggleRegex={() => setDrawOptions({ highlightUseRegex: !highlightUseRegex })}
    />
  );
}
