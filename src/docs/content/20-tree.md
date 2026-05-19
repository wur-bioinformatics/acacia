# Tree

The Tree view renders the current phylogeny as interactive SVG. Each node and branch is a real DOM element, so hover, click, and styling are all native browser interactions.

The tree shown is either:

1. computed by the **Analyse** menu in MSA view, or
2. imported from a Newick file via the Tree toolbar's **File → Import tree…**.

When you import a tree whose leaf names do not all appear in the alignment, a warning bar lists the unmatched names. When you edit the alignment after building a tree, a "stale tree" warning appears — recompute to refresh.

## Toolbar

The Tree toolbar has four menus plus an inspect/drag toggle and a search field.

![Tree toolbar](/docs-assets/tree-toolbar.png)

## Layout modes

Open **View → Layout** to switch between three layouts:

- **Rectangular** — classic horizontal tree with branch lengths drawn to scale.
- **Cladogram** — equal branch lengths; emphasizes topology over distance.
- **Radial** — a circular tree.

![Layout modes](/docs-assets/tree-layouts.png)

## Show / hide labels

**View → Show** toggles three optional decorations:

- **Bootstrap values** — bootstrap support next to each internal node.
- **Branch lengths** — numeric length labels on each branch.
- **Scale bar** — a horizontal scale at the bottom of the view.

## Sizes

**View → Sizes** has four sliders that adjust visual density:

- **Row height** — vertical spacing between leaves (10–60 px).
- **Branch width** — line thickness (0.5–6).
- **Label size** — leaf label font size (8–24 px).
- **Node radius** — size of node markers (0–8 px; 0 hides them).

## Pan and zoom

Drag inside the tree to pan. Scroll to zoom. **View → Reset zoom** snaps back to the default fit.

## Arrange menu

### Root

- **Midpoint root** — automatically reroots the tree at its midpoint.
- **Reset to original root** — restores the original root after any rerooting.

You can also reroot by clicking a node or a branch (see [Node panel](#node-panel) / [Branch panel](#branch-panel) below).

### Ladderize

Reorders sibling clades to climb visually. **Smallest first** puts the shorter clade on top; **Largest first** reverses it.

### Bootstrap

Set a threshold between 0 and 100; **Collapse below threshold** collapses every internal node whose bootstrap support falls under that value into a polytomy. **Revert collapse** undoes the last collapse.

### Reset

- **Reset selection & styling** — clears any per-node or per-branch colors and bold/highlight states.
- **Reset all** — rebuilds the tree from scratch, discarding all rerooting, collapsing, and styling.

## File menu

- **Import tree…** — open a Newick file. Sequences in the file that do not appear in the alignment are flagged but still drawn.
- **Export → SVG** — vector export of the current view.
- **Export → PNG** — raster export at the current zoom.
- **Export → Newick** — the tree in Newick format, reflecting any rerooting and collapsing.

## Inspect vs Drag mode

The two-state toggle in the toolbar switches the click behavior on the canvas:

- **Inspect mode** (default) — clicking a node or a branch opens its panel (see below).
- **Drag mode** — clicking and dragging a node moves it; the leaves underneath reorder, and the alignment in MSA view rearranges to match.

## Node panel

Click any node to open the node panel near the cursor.

For an internal node, you can:

- **Reroot here** — make this node the root.
- **Rotate children** — flip the order of immediate children.
- **Color clade** — pick a color that propagates to all descendants.
- **Collapse / expand clade** — collapse the entire clade into a single triangle, or expand again.
- **Bold / normal label** — emphasize a label.
- **Clear node style** — remove any per-node color/bold state.

For a leaf, you can color the label, toggle bold, and clear styling.

## Branch panel

Click any branch (the line between two nodes) to open the branch panel.

- **Reroot here** — reroot on this branch.
- **Color branch** — recolor just this branch.
- **Color clade branches** — recolor every branch descending from this node (internal branches only).
- **Clear branch style** — restore the default.

## Search

The search field at the right of the toolbar matches leaf names. Toggle the regex icon to switch between substring matching and regex.

## Drag-reorder

In Drag mode, dragging a leaf rearranges sibling order. The reorder is shared with the MSA view via the sequence store, so the alignment automatically follows the new leaf order.
