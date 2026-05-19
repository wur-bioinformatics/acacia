# Getting started

Acacia is a browser-based viewer for multiple sequence alignments (MSAs) and phylogenetic trees. Everything runs locally — no files are uploaded to a server.

## Load a FASTA file

In the **MSA** tab, drag a FASTA file onto the upload area or click to pick one. Acacia auto-detects whether the sequences are DNA or protein and picks a sensible default color scheme.

If you do not have a FASTA file handy, click **Load example data** to load a small protein alignment for exploration.

![MSA after loading example data](/docs-assets/msa-overview.png)

## Inspect the alignment

Scroll with the trackpad / mouse wheel to zoom in and out. Drag inside the canvas to pan. The **minimap** at the bottom shows the whole alignment with a draggable viewport rectangle for quick navigation.

Hover over a row to highlight it; click a column to select it.

## Compute a tree

Open the **Analyse** menu in the MSA toolbar, pick a substitution model (PDiff is a safe default that works for both DNA and protein), set the number of bootstrap replicates, and click **Run**.

Acacia computes the neighbor-joining tree in a Web Worker — the UI stays responsive — and switches to the **Tree** tab when it is finished.

## Explore the tree

In the Tree view you can:

- Switch layout (rectangular, cladogram, radial) from the **View** menu.
- Click a node to reroot the tree there, rotate children, collapse a clade, or color a clade.
- Click a branch to reroot or recolor a single branch.
- Drag a node (in **Drag** mode) to reorder leaves; the MSA reorders to match.
- Collapse poorly supported clades by setting a bootstrap threshold under **Arrange → Bootstrap**.

## Export your work

From the Tree toolbar's **File → Export** menu, save the current tree as **SVG**, **PNG**, or **Newick**. The MSA toolbar's undo/redo group can also export the full edit log as JSON for reproducibility.
