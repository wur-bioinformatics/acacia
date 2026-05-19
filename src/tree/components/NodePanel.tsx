import { useEffect, useRef } from "react";
import type { JSX } from "react";
import {
  findLayoutNode,
  getSubtreeNodes,
} from "../layout";
import type { LayoutNode, PanelState } from "../types";
import { useTreeStore } from "../treeStore";
import { useDocsStore } from "../../docs/docsStore";
import { cn } from "@/lib/utils";

const itemClass =
  "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground outline-none";

export default function NodePanel({
  panel,
  layoutRoot,
  onClose,
}: {
  panel: PanelState;
  layoutRoot: LayoutNode;
  onClose: () => void;
}): JSX.Element {
  const {
    collapsedNodes,
    nodeStyles,
    toggleCollapse,
    setNodeStyle,
    clearNodeStyle,
    rerootOnBranch,
    rotateNode,
  } = useTreeStore();
  const ref = useRef<HTMLDivElement>(null);

  const styleKey = panel.isLeaf
    ? `leaf:${panel.leafName ?? panel.id}`
    : panel.id;
  const isCollapsed = collapsedNodes.has(panel.id);
  const currentStyle = nodeStyles.get(styleKey);
  const currentColor = currentStyle?.color ?? "#111111";

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

  const handleRotate = () => {
    rotateNode(panel.id);
    ref.current?.hidePopover();
  };

  const handleColorClade = (color: string) => {
    const node = findLayoutNode(layoutRoot, panel.id);
    if (!node) return;
    for (const n of getSubtreeNodes(node)) {
      const key = n.children.length === 0 ? `leaf:${n.name}` : n.id;
      setNodeStyle(key, { color });
    }
  };

  const handleClearClade = () => {
    const node = findLayoutNode(layoutRoot, panel.id);
    if (!node) return;
    for (const n of getSubtreeNodes(node)) {
      const key = n.children.length === 0 ? `leaf:${n.name}` : n.id;
      clearNodeStyle(key);
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
      {!panel.isLeaf && (
        <>
          <button className={itemClass} onClick={handleRotate}>
            Rotate children
          </button>
          <label className={cn(itemClass, "justify-between")}>
            Color clade…
            <input
              type="color"
              colorspace="display-p3"
              className="sr-only"
              value={currentColor}
              onChange={(e) => handleColorClade(e.target.value)}
            />
          </label>
        </>
      )}
      {(!panel.isLeaf || isCollapsed) && (
        <button
          className={itemClass}
          onClick={() => {
            toggleCollapse(panel.id);
            ref.current?.hidePopover();
          }}
        >
          {isCollapsed ? "Expand clade" : "Collapse clade"}
        </button>
      )}
      <label className={cn(itemClass, "justify-between")}>
        Color {panel.isLeaf ? "leaf" : "node"}…
        <input
          type="color"
          colorspace="display-p3"
          className="sr-only"
          value={currentColor}
          onChange={(e) => setNodeStyle(styleKey, { color: e.target.value })}
        />
      </label>
      <button
        className={itemClass}
        onClick={() =>
          setNodeStyle(styleKey, {
            labelBold: !(currentStyle?.labelBold ?? false),
          })
        }
      >
        {currentStyle?.labelBold ? "Normal label" : "Bold label"}
      </button>
      <button
        className={itemClass}
        onClick={() => {
          clearNodeStyle(styleKey);
          ref.current?.hidePopover();
        }}
      >
        Clear style
      </button>
      {!panel.isLeaf && (
        <button className={itemClass} onClick={handleClearClade}>
          Clear clade styles
        </button>
      )}
      <button
        className={cn(itemClass, "opacity-50")}
        onClick={() => {
          useDocsStore.getState().openDocs("node-panel");
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
