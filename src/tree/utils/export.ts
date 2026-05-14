import type { FlatTree, NodeId, NodeStyle } from "../types";
import type { LayoutResult } from "../layout";
import { collectVisible } from "./drag";
import { matchesQuery } from "./search";

// ---------------------------------------------------------------------------
// Newick serialization
// ---------------------------------------------------------------------------

export function flatTreeToNewick(tree: FlatTree): string {
  const { nodes, rootId } = tree;

  function serialize(id: NodeId): string {
    const node = nodes.get(id)!;
    const lenSuffix = `:${node.length}`;
    if (node.childIds.length === 0) {
      return `${node.name}${lenSuffix}`;
    }
    const children = node.childIds.map(serialize).join(",");
    return `(${children})${node.name}${lenSuffix}`;
  }

  return `${serialize(rootId)};`;
}

// ---------------------------------------------------------------------------
// SVG serialization
// ---------------------------------------------------------------------------

export type ExportStyleContext = {
  nodeStyles: ReadonlyMap<string, NodeStyle>;
  searchQuery: string;
  searchUseRegex: boolean;
  selectedNodeId: NodeId | null;
  labelFontSize: number;
};

export function serializeTreeSVG(
  svgEl: SVGSVGElement,
  layoutResult: LayoutResult,
  yStep: number,
  treeWidth: number,
  collapsedNodes: ReadonlySet<NodeId>,
  mode: "rect" | "radial",
  styleContext: ExportStyleContext,
): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  // Inline font-family on root so the file renders correctly outside the app.
  const existingStyle = clone.getAttribute("style") ?? "";
  clone.setAttribute(
    "style",
    `font-family: "Azeret Mono", ui-monospace, monospace; ${existingStyle}`,
  );

  const svgNS = "http://www.w3.org/2000/svg";

  // White background so exported SVG isn't transparent on dark themes.
  const bg = document.createElementNS(svgNS, "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "white");
  clone.insertBefore(bg, clone.firstChild);

  if (mode !== "radial") {
    // Rect/cladogram: labels live in a DOM panel outside the SVG. Inject as <text>,
    // matching the style resolution in TreeLabels so export reproduces what's on screen.
    const g = clone.querySelector("g");
    if (g) {
      const rows = collectVisible(layoutResult.root, collapsedNodes);
      const { nodeStyles, searchQuery, searchUseRegex, selectedNodeId, labelFontSize } = styleContext;
      const searchActive = searchQuery.length > 0;

      for (const row of rows) {
        const isCollapsed = collapsedNodes.has(row.id);
        const isLeaf = row.children.length === 0;
        const styleKey = isLeaf ? `leaf:${row.name}` : row.id;
        const style = nodeStyles.get(styleKey);
        const isSelected = selectedNodeId === row.id;
        const displayName = isCollapsed ? `${row.leafCount} sequences` : row.name;
        const matchesSearch =
          searchActive && matchesQuery(displayName, searchQuery, searchUseRegex);

        const fill = isSelected ? "#3b82f6" : (style?.color ?? "#111");
        const fontWeight = style?.labelBold || matchesSearch ? "bold" : "normal";
        const fontStyle = isCollapsed ? "italic" : "normal";
        const opacity = searchActive && !matchesSearch ? "0.2" : "1";

        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", String(treeWidth + 8));
        text.setAttribute("y", String(row.y + yStep * 0.35));
        text.setAttribute("font-size", String(labelFontSize));
        text.setAttribute("fill", fill);
        text.setAttribute("font-weight", fontWeight);
        text.setAttribute("font-style", fontStyle);
        text.setAttribute("opacity", opacity);
        text.textContent = displayName;
        g.appendChild(text);
      }
    }
  }

  return new XMLSerializer().serializeToString(clone);
}

// ---------------------------------------------------------------------------
// PNG serialization
// ---------------------------------------------------------------------------

// Rasterizes the serialized SVG to a PNG blob via a temporary <canvas>.
// Uses 2× pixel ratio for crisp output on high-DPI displays.
export async function serializeTreePNG(svg: string): Promise<Blob> {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load SVG image"));
    });
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------------------
// Download helpers
// ---------------------------------------------------------------------------

export function downloadFile(content: string | Blob, filename: string, mimeType: string): void {
  const blob = typeof content === "string" ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
