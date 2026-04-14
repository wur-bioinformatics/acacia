import { useEffect, useRef } from "react";
import type { JSX } from "react";
import {
  findLayoutNode,
  getSubtreeNodes,
  rerootTree,
  rotateNode,
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
    setRoot,
    root,
  } = useTreeStore();
  const ref = useRef<HTMLDivElement>(null);

  const styleKey = panel.isLeaf ? `leaf:${panel.leafName ?? panel.id}` : panel.id;
  const isCollapsed = collapsedNodes.has(panel.id);
  const currentStyle = nodeStyles.get(styleKey);
  const currentColor = currentStyle?.color ?? "#111111";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [onClose]);

  const handleReroot = () => {
    if (!root) return;
    setRoot(rerootTree(root, panel.id));
    onClose();
  };

  const handleRotate = () => {
    if (!root) return;
    setRoot(rotateNode(root, panel.id));
    onClose();
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
    onClose();
  };

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    left: panel.x + 8,
    top: panel.y + 8,
    zIndex: 50,
  };

  return (
    <div
      ref={ref}
      style={panelStyle}
      className="bg-base-100 rounded-box shadow-lg border border-base-300 p-2 flex flex-col gap-1 text-sm min-w-max"
    >
      {!panel.isLeaf && (
        <>
          <button className="btn btn-xs btn-ghost justify-start" onClick={handleReroot}>
            Reroot here
          </button>
          <button
            className="btn btn-xs btn-ghost justify-start"
            onClick={() => { toggleCollapse(panel.id); onClose(); }}
          >
            {isCollapsed ? "Expand clade" : "Collapse clade"}
          </button>
          <button className="btn btn-xs btn-ghost justify-start" onClick={handleRotate}>
            Rotate children
          </button>
          <label className="btn btn-xs btn-ghost justify-start cursor-pointer">
            Color clade…
            <input
              type="color"
              className="sr-only"
              value={currentColor}
              onChange={(e) => handleColorClade(e.target.value)}
            />
          </label>
          <hr className="border-base-300" />
        </>
      )}
      <label className="btn btn-xs btn-ghost justify-start cursor-pointer">
        Color {panel.isLeaf ? "leaf" : "node"}…
        <input
          type="color"
          className="sr-only"
          value={currentColor}
          onChange={(e) => setNodeStyle(styleKey, { color: e.target.value })}
        />
      </label>
      <button
        className="btn btn-xs btn-ghost justify-start"
        onClick={() => setNodeStyle(styleKey, { labelBold: !(currentStyle?.labelBold ?? false) })}
      >
        {currentStyle?.labelBold ? "Normal label" : "Bold label"}
      </button>
      <button
        className="btn btn-xs btn-ghost justify-start"
        onClick={() => { clearNodeStyle(styleKey); onClose(); }}
      >
        Clear style
      </button>
      {!panel.isLeaf && (
        <button className="btn btn-xs btn-ghost justify-start" onClick={handleClearClade}>
          Clear clade styles
        </button>
      )}
      <button className="btn btn-xs btn-ghost justify-start opacity-50" onClick={onClose}>
        ✕ Close
      </button>
    </div>
  );
}
