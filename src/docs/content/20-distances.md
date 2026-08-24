# Distances

The Distances tab shows the pairwise distance matrix as a heatmap, with the sequence labels along the left and top. It sits between MSA and Tree because it is the middle step of the pipeline: an alignment yields distances, and distances yield a tree.

The matrix comes from either:

1. **Analyse → Compute distances** in the MSA view — distances only, no tree, and
2. **Analyse → Build NJ tree** in the MSA view — the tree build produces the same matrix as a by-product.

![Distance matrix](/docs-assets/distances-overview.png)

## Analyse menu

**Build NJ tree** infers a tree from the distances on screen. The substitution model is fixed to the one the matrix was computed with — it is shown at the top of the submenu — so only the **Bootstrap replicates** count is still open. Click **Build tree** to run it; the view switches to the Tree tab when it finishes.

To use a different substitution model, go back to the MSA view and recompute the distances there.

## View options

The **View** dropdown lets you:

- **Show numbers** — overlay the raw distance value in each cell.
- **Color scheme** — pick **Warm**, **Cool**, **Green**, or **Grayscale**.

## Average distance

The right side of the toolbar shows the average pairwise distance, which is a quick proxy for overall divergence within the alignment.

## Sequence order

Sequences appear in the same order as the MSA. Reordering in MSA or Tree view propagates here.

## Stale state

If you edit the alignment after computing the matrix, a warning bar appears at the top. Recompute the distances from the MSA view's Analyse menu to refresh.
