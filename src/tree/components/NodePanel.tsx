import { useEffect, useRef } from "react";
import type { JSX } from "react";
import {
  findLayoutNode,
  getSubtreeNodes,
} from "../layout";
import type { LayoutNode } from "../types";
import { useTreeStore } from "../treeStore";

export type PanelState = {
  id: string;
  isLeaf: boolean;
  leafName?: string;
  x: number;
  y: number;
};

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
      const key = n.children.length === 0 ? `leaf:${n.node.name}` : n.id;
      setNodeStyle(key, { color });
    }
  };

  const handleClearClade = () => {
    const node = findLayoutNode(layoutRoot, panel.id);
    if (!node) return;
    for (const n of getSubtreeNodes(node)) {
      const key = n.children.length === 0 ? `leaf:${n.node.name}` : n.id;
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
      className="menu menu-sm bg-base-100 rounded-box shadow-lg border border-base-300 min-w-max p-2"
    >
      <li>
        <button onClick={handleReroot}>Reroot here</button>
      </li>
      {!panel.isLeaf && (
        <>
          <li>
            <button onClick={handleRotate}>Rotate children</button>
          </li>
          <li>
            <label>
              Color clade…
              <input
                type="color"
                colorspace="display-p3"
                className="sr-only"
                value={currentColor}
                onChange={(e) => handleColorClade(e.target.value)}
              />
            </label>
          </li>
        </>
      )}
      {(!panel.isLeaf || isCollapsed) && (
        <>
          <li>
            <button
              onClick={() => {
                toggleCollapse(panel.id);
                ref.current?.hidePopover();
              }}
            >
              {isCollapsed ? "Expand clade" : "Collapse clade"}
            </button>
          </li>
        </>
      )}
      <li>
        <label>
          Color {panel.isLeaf ? "leaf" : "node"}…
          <input
            type="color"
            colorspace="display-p3"
            className="sr-only"
            value={currentColor}
            onChange={(e) => setNodeStyle(styleKey, { color: e.target.value })}
          />
        </label>
      </li>
      <li>
        <button
          onClick={() =>
            setNodeStyle(styleKey, {
              labelBold: !(currentStyle?.labelBold ?? false),
            })
          }
        >
          {currentStyle?.labelBold ? "Normal label" : "Bold label"}
        </button>
      </li>
      <li>
        <button
          onClick={() => {
            clearNodeStyle(styleKey);
            ref.current?.hidePopover();
          }}
        >
          Clear style
        </button>
      </li>
      {!panel.isLeaf && (
        <li>
          <button onClick={handleClearClade}>Clear clade styles</button>
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
