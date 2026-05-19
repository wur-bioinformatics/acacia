import { useEffect, useRef } from "react";
import type { JSX } from "react";
import { branchKey, findLayoutNode, getSubtreeNodes } from "../layout";
import type { LayoutNode, PanelState } from "../types";
import { useTreeStore } from "../treeStore";
import { useDocsStore } from "../../docs/docsStore";
import { cn } from "@/lib/utils";

const itemClass =
  "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground outline-none";

export default function BranchPanel({
  panel,
  layoutRoot,
  onClose,
}: {
  panel: PanelState;
  layoutRoot: LayoutNode;
  onClose: () => void;
}): JSX.Element {
  const { branchStyles, setBranchStyle, clearBranchStyle, rerootOnBranch } =
    useTreeStore();
  const ref = useRef<HTMLDivElement>(null);

  const node = findLayoutNode(layoutRoot, panel.id);
  const key = node ? branchKey(node) : `branch:${panel.id}`;
  const currentColor = branchStyles.get(key)?.color ?? "#333333";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!el.matches(":popover-open")) el.showPopover();
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === "closed") onClose();
    };
    el.addEventListener("toggle", onToggle);
    return () => el.removeEventListener("toggle", onToggle);
  }, [onClose]);

  const handleReroot = () => {
    rerootOnBranch(panel.id);
    ref.current?.hidePopover();
  };

  const handleColorBranch = (color: string) => {
    setBranchStyle(key, color);
  };

  const handleColorClade = (color: string) => {
    if (!node) return;
    for (const n of getSubtreeNodes(node)) {
      setBranchStyle(branchKey(n), color);
    }
  };

  const handleClearBranch = () => {
    clearBranchStyle(key);
    ref.current?.hidePopover();
  };

  const handleClearClade = () => {
    if (!node) return;
    for (const n of getSubtreeNodes(node)) {
      clearBranchStyle(branchKey(n));
    }
    ref.current?.hidePopover();
  };

  return (
    <div
      ref={ref}
      popover="auto"
      style={{
        position: "fixed",
        inset: "unset",
        left: panel.x + 8,
        top: panel.y + 8,
        margin: 0,
      }}
      className="bg-popover text-popover-foreground rounded-md border shadow-md min-w-max p-1"
    >
      <button className={itemClass} onClick={handleReroot}>
        Reroot here
      </button>
      <label className={cn(itemClass, "justify-between")}>
        Color branch…
        <input
          type="color"
          colorspace="display-p3"
          className="sr-only"
          value={currentColor}
          onChange={(e) => handleColorBranch(e.target.value)}
        />
      </label>
      {!panel.isLeaf && (
        <label className={cn(itemClass, "justify-between")}>
          Color clade branches…
          <input
            type="color"
            colorspace="display-p3"
            className="sr-only"
            value={currentColor}
            onChange={(e) => handleColorClade(e.target.value)}
          />
        </label>
      )}
      <button className={itemClass} onClick={handleClearBranch}>
        Clear branch style
      </button>
      {!panel.isLeaf && (
        <button className={itemClass} onClick={handleClearClade}>
          Clear clade branch styles
        </button>
      )}
      <button
        className={cn(itemClass, "opacity-50")}
        onClick={() => {
          useDocsStore.getState().openDocs("branch-panel");
          ref.current?.hidePopover();
        }}
      >
        ? Documentation
      </button>
      <button
        className={cn(itemClass, "opacity-50")}
        onClick={() => ref.current?.hidePopover()}
      >
        ✕ Close
      </button>
    </div>
  );
}
