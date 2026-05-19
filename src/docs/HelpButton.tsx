import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDocsStore } from "./docsStore";

interface HelpButtonProps {
  anchor: string;
  label?: string;
}

export function HelpButton({ anchor, label = "Open documentation" }: HelpButtonProps) {
  const openDocs = useDocsStore((s) => s.openDocs);
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-50 hover:opacity-100 transition-opacity"
            onClick={() => openDocs(anchor)}
            aria-label={label}
            title={label}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
