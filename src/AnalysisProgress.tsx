import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useNJStore } from "./NJ/stores/njStore";
import { useQualityStore } from "./MSA/stores/qualityStore";

type ActiveAnalysis = {
  label: string;
  stage?: string;
  current?: number;
  total?: number;
  fraction: number | null;
  cancel: (() => void) | null;
};

function formatLabel(a: ActiveAnalysis): string {
  if (a.label === "TRIDENT") return "TRIDENT…";
  const head = a.stage ? `${a.label} · ${a.stage}` : a.label;
  if (a.current != null && a.total != null) {
    return `${head} ${a.current} / ${a.total}`;
  }
  return `${head}…`;
}

export function AnalysisProgress() {
  const njStatus = useNJStore((s) => s.status);
  const njCurrent = useNJStore((s) => s.progress?.current);
  const njTotal = useNJStore((s) => s.progress?.total);
  const njCancel = useNJStore((s) => s.cancel);
  const tcsStatus = useQualityStore((s) => s.tcsStatus);
  const tcsStage = useQualityStore((s) => s.tcsProgress?.stage);
  const tcsCurrent = useQualityStore((s) => s.tcsProgress?.current);
  const tcsTotal = useQualityStore((s) => s.tcsProgress?.total);
  const tcsCancel = useQualityStore((s) => s.tcsCancel);
  const tridentStatus = useQualityStore((s) => s.tridentStatus);
  const tridentCancel = useQualityStore((s) => s.tridentCancel);

  const active = useMemo<ActiveAnalysis | null>(() => {
    if (njStatus === "running") {
      return {
        label: "Building tree",
        stage: "bootstrap",
        current: njCurrent,
        total: njTotal,
        fraction:
          njCurrent != null && njTotal != null && njTotal > 0
            ? njCurrent / njTotal
            : null,
        cancel: njCancel,
      };
    }
    if (tcsStatus === "running") {
      return {
        label: "TCS",
        stage: tcsStage,
        current: tcsCurrent,
        total: tcsTotal,
        fraction:
          tcsCurrent != null && tcsTotal != null && tcsTotal > 0
            ? tcsCurrent / tcsTotal
            : null,
        cancel: tcsCancel,
      };
    }
    if (tridentStatus === "running") {
      return { label: "TRIDENT", fraction: null, cancel: tridentCancel };
    }
    return null;
  }, [
    njStatus,
    njCurrent,
    njTotal,
    njCancel,
    tcsStatus,
    tcsStage,
    tcsCurrent,
    tcsTotal,
    tcsCancel,
    tridentStatus,
    tridentCancel,
  ]);

  const [displayed, setDisplayed] = useState<ActiveAnalysis | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      setDisplayed(active);
      setVisible(true);
      return;
    }
    setVisible(false);
    const t = setTimeout(() => setDisplayed(null), 250);
    return () => clearTimeout(t);
  }, [active]);

  if (!displayed) return null;

  const labelText = formatLabel(displayed);
  const widthPct =
    displayed.fraction != null
      ? Math.max(0, Math.min(100, displayed.fraction * 100))
      : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={labelText}
      className={`fixed top-0 inset-x-0 z-50 bg-background/90 backdrop-blur-sm border-b border-border transition-opacity duration-200 pointer-events-none ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="relative h-[2px] bg-muted overflow-hidden">
        {displayed.fraction != null ? (
          <div
            className="absolute top-0 left-0 h-full bg-primary transition-[width] duration-200 ease-out overflow-hidden"
            style={{ width: `${widthPct}%` }}
          >
            <div className="absolute inset-0 acacia-sheen" />
          </div>
        ) : (
          <div className="absolute inset-0 acacia-indeterminate" />
        )}
      </div>
      <div className="flex justify-end items-center gap-1 px-3 py-0.5 text-[10px] font-mono text-muted-foreground">
        <span>{labelText}</span>
        {displayed.cancel ? (
          <button
            type="button"
            onClick={displayed.cancel}
            aria-label="Cancel"
            title="Cancel"
            className="pointer-events-auto inline-flex items-center justify-center rounded-sm h-3.5 w-3.5 hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-3" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
