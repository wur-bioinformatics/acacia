import { useEffect, useRef } from "react";
import type { JSX } from "react";
import { findLayoutNode, getSubtreeNodes } from "../layout";
import type { LayoutNode } from "../types";
import { useTreeStore } from "../treeStore";
import type { PanelState } from "./NodePanel";

function branchKey(node: LayoutNode): string {
  return node.children.length === 0
    ? `branch:leaf:${node.node.name}`
    : `branch:${node.id}`;
}

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
      className="menu menu-sm bg-base-100 rounded-box shadow-lg border border-base-300 min-w-max p-2"
    >
      <li>
        <button onClick={handleReroot}>Reroot here</button>
      </li>
      <li>
        <label>
          Color branch…
          <input
            type="color"
            colorspace="display-p3"
            className="sr-only"
            value={currentColor}
            onChange={(e) => handleColorBranch(e.target.value)}
          />
        </label>
      </li>
      {!panel.isLeaf && (
        <li>
          <label>
            Color clade branches…
            <input
              type="color"
              colorspace="display-p3"
              className="sr-only"
              value={currentColor}
              onChange={(e) => handleColorClade(e.target.value)}
            />
          </label>
        </li>
      )}
      <li>
        <button onClick={handleClearBranch}>Clear branch style</button>
      </li>
      {!panel.isLeaf && (
        <li>
          <button onClick={handleClearClade}>Clear clade branch styles</button>
        </li>
      )}
      <li>
        <button
          className="opacity-50"
          onClick={() => ref.current?.hidePopover()}
        >
          ✕ Close
        </button>
      </li>
    </div>
  );
}
