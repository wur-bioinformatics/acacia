import { useRef, type JSX } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function isValidRegex(pattern: string): boolean {
  try { new RegExp(pattern); return true; }
  catch { return false; }
}

type SearchInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  useRegex?: boolean;
  onToggleRegex?: () => void;
};

export default function SearchInput({
  value,
  onValueChange,
  placeholder = "Find…",
  className,
  useRegex,
  onToggleRegex,
}: SearchInputProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const regexError = !!useRegex && !!value && !isValidRegex(value);

  const handleClear = () => {
    onValueChange("");
    inputRef.current?.focus();
  };

  return (
    <div className="flex items-center gap-1">
      <div className="relative flex items-center">
        <Input
          ref={inputRef}
          type="text"
          size="xs"
          placeholder={placeholder}
          aria-invalid={regexError || undefined}
          className={cn("w-32 pr-5", regexError && "border-destructive", className)}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") handleClear();
          }}
          spellCheck={false}
        />
        {value && (
          <button
            className="absolute right-1 opacity-50 hover:opacity-100 text-xs leading-none"
            onClick={handleClear}
            tabIndex={-1}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>
      {onToggleRegex && (
        <Button
          size="xs"
          variant={useRegex ? "default" : "ghost"}
          title={useRegex ? "Regex on" : "Regex off"}
          onClick={onToggleRegex}
          className="font-mono"
        >
          .*
        </Button>
      )}
    </div>
  );
}
