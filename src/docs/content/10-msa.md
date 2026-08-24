# MSA

The MSA view renders a multiple sequence alignment on a canvas. It is designed to handle large alignments smoothly: the main render runs in an OffscreenCanvas Web Worker, and a transparent overlay canvas handles hover and selection without redrawing the underlying pixels.

## Toolbar

The toolbar at the top of the MSA view exposes every operation in four menus plus a search field and a sequence-type toggle.

![MSA toolbar](/docs-assets/msa-toolbar.png)

## File menu

- **Import FASTA…** — loads a new aligned FASTA file, replacing the current alignment. The file must be aligned (all sequences the same length); otherwise the import is rejected with an error. If you have unsaved edits, you are asked to confirm before they are discarded.
- **Export FASTA → Current alignment** — saves the alignment as you currently see it: with row/column removals and renames applied, in the current display order.
- **Export FASTA → Original (unedited)** — saves the alignment exactly as it was imported, before any edits.

## Analyse menu

Computes pairwise distances, builds a phylogenetic tree, and computes per-column quality scores. Distances and tree are two steps of one pipeline: you can run them together, or stop after the distances and continue from the Distances view later.

### Compute distances

Computes the pairwise distance matrix only — no tree, no bootstrapping, so it is quick. The view switches to the Distances tab when it finishes; from there **Analyse → Build NJ tree** continues to a tree.

- **Substitution model** / **Rate heterogeneity** — the same options as below; the two submenus share one set of settings.
- **Compute distances** — runs the computation in a Web Worker.

### Build NJ tree

Computes distances and infers the tree in one go, so the Distances tab is populated as well.

- **Substitution model** — PDiff (p-distance, works for any alphabet); Jukes-Cantor, Kimura 2P, Tajima-Nei and Tamura (DNA only); Poisson and Kimura (protein only). The options that do not match the detected sequence type are disabled.
- **Rate heterogeneity** — optional corrections that model variation in substitution rate across sites. **Gamma shape α** applies a gamma rate distribution (smaller α = more rate variation); **Invariant sites** sets the proportion of sites assumed never to change. Both have no effect on PDiff and are disabled when it is selected.
- **Bootstrap replicates** — how many bootstrap iterations to run. Set to 0 to skip bootstrapping.
- **Build tree** — kicks off the computation in a Web Worker. The MSA status bar shows progress; the view switches to the Tree tab when finished.

### MSA quality

**Compute** runs the TRIDENT and TCS column-quality scores in a Web Worker. Both scores are produced in one pass; progress appears in the status bar (`library N/M` while the pairwise library is being built, then `scoring N/M` while columns are evaluated).

Editing the alignment (removing rows or columns) marks the cached scores as stale — the status bar shows `quality stale — recompute` and the TRIDENT/TCS view options are disabled until you click **Compute** again. Renaming a row does not invalidate the scores.

Runtime grows roughly as O(N² × L²) — large alignments (hundreds of sequences, thousands of columns) may take a while.

## View dropdown

Controls what the canvas shows and how it is colored.

- **Show labels** — sequence names in the left column.
- **Show letters** — residue letters drawn on top of colored cells (hidden automatically when zoomed out).
- **Show consensus** — a synthetic consensus row above the alignment.
- **Show minimap** — the panel that shows the whole alignment.
- **Track** — choose **None**, **Conservation** (per-column score), **Logo** (sequence-logo bar), **TRIDENT**, or **TCS** for the optional track panel below the minimap. TRIDENT and TCS are only selectable after running **Analyse → Compute**.
- **Color options** — pick a coloring scheme. Group availability depends on the current sequence type:
  - DNA: **DNA** (standard ACGT) and **DNA ClustalX**.
  - Protein: **AA ClustalX**, **AA Zappo** (physicochemical), **AA Taylor** (spectral).
  - Analysis: **Parsimony Informative**, **Conserved**, **Variable**.
  - Quality: **TRIDENT** and **TCS** tint each cell by its column quality score. Available after running **Analyse → Compute**.

## Search

The search field in the toolbar accepts a literal substring or, with the regex toggle on, a regular expression. Matches are highlighted in the labels column.

## Sequence type toggle

Acacia auto-detects DNA vs protein from the alignment contents. The toggle on the right of the toolbar lets you override that decision if the detection picks the wrong one — for instance, if you have a degenerate IUPAC alphabet that looks like protein.

## Pan and zoom

Scroll vertically or horizontally to pan. Hold a modifier and scroll to zoom along each axis independently (the exact modifier depends on your OS; trackpad pinch-to-zoom works as expected). Drag the canvas to pan freely.

## Minimap and tracks

The **minimap** at the bottom of the view shows the entire alignment at a glance with a draggable viewport rectangle. Drag the rectangle, or click anywhere on the minimap, to jump.

The **track panel** between the minimap and the main canvas appears when a track is selected in the View dropdown. It renders one of:

- **Conservation** — a column-wise score (fraction of non-gap residues matching the consensus).
- **Logo** — a sequence-logo style bar.
- **TRIDENT** — a per-column quality bar combining conservation, residue similarity, and gap penalty.
- **TCS** — per-column **mean** of the per-residue transitive consistency scores.

The boundary between the main canvas, the track, and the minimap is draggable for resizing.

## Scalebar and cursor position

The **scalebar** sits directly above the main canvas and rules off alignment columns with labelled ticks. It shares the canvas pan and zoom, so the ticks stay on their columns, and the tick interval coarsens as you zoom out. A blue marker tracks the column under the cursor. It is always shown.

Positions are 1-based: the tick labelled `50` sits on the 50th column.

Two readouts follow the cursor across the alignment:

- A blue **position badge** at the right of the status bar, showing the row and column under the pointer.
- A small **tooltip** next to the pointer with the same coordinates, which appears once the cursor is held still.

Both read `consensus` in place of a row number while the pointer is over the consensus row.

## MSA quality scores

The **TRIDENT** and **TCS** scores are computed on demand via **Analyse → Compute** and surface in two places: as a track-panel bar, and as a cell color scheme that tints the alignment.

### TRIDENT

TRIDENT (Valdar 2002) is the product of three normalized factors per column:

- **C** — conservation: 1 − normalized Shannon entropy over non-gap residue frequencies.
- **R** — residue similarity: the mean pairwise substitution score across non-gap residue pairs in the column, normalized to [0, 1] against the substitution matrix's min/max. BLOSUM62 is used for protein; a +5 / −4 match-mismatch matrix for DNA.
- **G** — gap penalty: 1 − (gap count / row count).

The final per-column score is `C × R × G`. High scores (≈ 1) indicate well-supported columns; low scores indicate disagreement or gappiness.

### TCS

TCS (Transitive Consistency Score, Chang et al. 2014 / T-Coffee) is a **per-residue** score. For each non-gap residue at column j of sequence s, it measures the fraction of other non-gap residues in column j whose pairwise alignment with s agrees with the column placement.

Acacia builds the library from pairwise Needleman-Wunsch global alignments (BLOSUM62 with affine gaps for protein; a +5 / −4 / open −10 / extend −1 scheme for DNA). For each MSA column, every non-gap residue pair is checked against the library: each member of a consistent pair receives a vote of confidence.

When TCS is selected under **Color options**, each cell is tinted by its own residue score — a poorly-supported residue stands out even in an otherwise consistent column. When TCS is selected under **Track**, the panel shows the per-column **mean** over non-gap residues.

The implementation is library-based but does not generate a multi-method library the way the original T-Coffee tool does; scores are calibrated only to themselves. Treat residues with TCS near 1 as well-supported and lower scores as candidates for closer inspection.

## Editing

All edits are recorded as a log against the original alignment so they can be replayed, undone, and exported.

### Rename row

Hover a label to reveal the pencil icon, click it (or double-click the label) to switch to inline edit, type a new name, and press **Enter** to commit.

### Remove row

Hover a label and click the **×** button, or select a row and press **Delete**/**Backspace**. Multiple rows can be selected at once — see [Multi-selection](#multi-selection).

### Remove column

Click a column on the quality/conservation track to select it, or use modifier-drag on the alignment to select a span (see below). Press **Delete**/**Backspace** to remove. **Escape** clears the selection without deleting.

### Multi-selection

Hold **Shift** or **Cmd/Ctrl** to draw a selection rectangle on the alignment:

- **Shift-drag** adds rows and columns to the selection.
- **Cmd/Ctrl-drag** toggles them (XOR).
- **Shift-click** on the track extends the column selection from the last-clicked anchor.
- **Cmd/Ctrl-click** on the track toggles a single column.

Plain drag on the alignment still pans the view. The Edit dropdown shows the current count and provides **Clear** and **Delete** buttons.

### Select by metric

The **Edit** dropdown's sliders build the same selection that manual dragging does — they just pick rows or columns by a metric instead of by hand. Every slider adds to the current selection (and dragging it back to 0 removes its own contribution), so you can combine criteria and mix them with a manual selection. The sliders are split into two groups:

**Select columns**

- **By conservation (keep ≥)** — columns whose identity (fraction of all rows matching the dominant residue) is at or above the threshold. Useful for isolating the well-conserved core.
- **By quality (TRIDENT <)** — columns whose per-column TRIDENT score is below the threshold.
- **By consistency (mean TCS <)** — columns whose mean TCS (over non-gap residues) is below the threshold.
- **By gaps (>)** — columns whose gap fraction is above the threshold.

**Select rows**

- **By consistency (mean TCS <)** — rows whose mean TCS (over non-gap positions) is below the threshold.
- **By gaps (>)** — rows whose gap fraction is above the threshold.

The TRIDENT and TCS sliders are enabled only after running **Analyse → Compute**; editing the alignment marks the scores stale and disables them again until you recompute. Each slider reports how many rows/columns it currently matches. **Clear** drops the selection and resets the sliders; **Delete** commits the selection as remove-row / remove-column edits (each individually undoable with **Cmd+Z**).

A deletion can never empty the alignment: if the selection covers every row or every column, **Delete** is disabled (and **Delete**/**Backspace** is ignored) — at least one row and one column always remain.

### Reorder rows

Drag a label up or down to reorder. The change is shared with the Tree and Distances views — they will rerender in the new order. Dragging in Tree view also reorders the MSA the same way.

### Undo / redo

**Cmd+Z** / **Ctrl+Z** undoes the last edit. **Cmd+Shift+Z** / **Ctrl+Shift+Z** redoes. The toolbar's undo/redo group also has buttons, and a third button exports the full edit log as JSON.
