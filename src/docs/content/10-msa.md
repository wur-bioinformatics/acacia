# MSA

The MSA view renders a multiple sequence alignment on a canvas. It is designed to handle large alignments smoothly: the main render runs in an OffscreenCanvas Web Worker, and a transparent overlay canvas handles hover and selection without redrawing the underlying pixels.

## Toolbar

The toolbar at the top of the MSA view exposes every operation in three menus plus a search field and a sequence-type toggle.

![MSA toolbar](/docs-assets/msa-toolbar.png)

## Analyse menu

Builds a phylogenetic tree from the current alignment.

- **Substitution model** — PDiff (p-distance, works for any alphabet), Jukes-Cantor and Kimura 2P (DNA only), Poisson (protein only). The options that do not match the detected sequence type are disabled.
- **Bootstrap replicates** — how many bootstrap iterations to run. Set to 0 to skip bootstrapping.
- **Run** — kicks off the computation in a Web Worker. The MSA status bar shows progress; the view switches to the Tree tab when finished.

## View dropdown

Controls what the canvas shows and how it is colored.

- **Show labels** — sequence names in the left column.
- **Show letters** — residue letters drawn on top of colored cells (hidden automatically when zoomed out).
- **Show consensus** — a synthetic consensus row above the alignment.
- **Show minimap** — the panel at the bottom that shows the whole alignment.
- **Track** — choose **None**, **Conservation** (per-column score), or **Logo** (sequence-logo bar) for the optional track panel below the minimap.
- **Color options** — pick a coloring scheme. Group availability depends on the current sequence type:
  - DNA: standard nucleotide colors, hydropathy (where applicable), consecutive.
  - Protein: standard amino-acid colors, hydropathy.
  - Universal: parsimony informative, conserved sites, variable sites.

## Search

The search field in the toolbar accepts a literal substring or, with the regex toggle on, a regular expression. Matches are highlighted in the labels column.

## Sequence type toggle

Acacia auto-detects DNA vs protein from the alignment contents. The toggle on the right of the toolbar lets you override that decision if the detection picks the wrong one — for instance, if you have a degenerate IUPAC alphabet that looks like protein.

## Pan and zoom

Scroll vertically or horizontally to pan. Hold a modifier and scroll to zoom along each axis independently (the exact modifier depends on your OS; trackpad pinch-to-zoom works as expected). Drag the canvas to pan freely.

## Minimap and tracks

The **minimap** at the bottom of the view shows the entire alignment at a glance with a draggable viewport rectangle. Drag the rectangle, or click anywhere on the minimap, to jump.

The **track panel** between the minimap and the main canvas appears when a track is selected in the View dropdown. It renders one of:

- **Conservation** — a column-wise score.
- **Logo** — a sequence-logo style bar.

The boundary between the main canvas, the track, and the minimap is draggable for resizing.

## Editing

All edits are recorded as a log against the original alignment so they can be replayed, undone, and exported.

### Rename row

Hover a label to reveal the pencil icon, click it (or double-click the label) to switch to inline edit, type a new name, and press **Enter** to commit.

### Remove row

Hover a label and click the **×** button, or select a row and press **Delete**/**Backspace**.

### Remove column

Click a column to select it, then press **Delete**/**Backspace**. **Escape** clears the column selection without deleting.

### Reorder rows

Drag a label up or down to reorder. The change is shared with the Tree and Distances views — they will rerender in the new order. Dragging in Tree view also reorders the MSA the same way.

### Undo / redo

**Cmd+Z** / **Ctrl+Z** undoes the last edit. **Cmd+Shift+Z** / **Ctrl+Shift+Z** redoes. The toolbar's undo/redo group also has buttons, and a third button exports the full edit log as JSON.
