# Distances

The Distances tab shows the pairwise distance matrix computed during the most recent tree build. It is a heatmap of distances with the sequence labels along the left and top.

![Distance matrix](/docs-assets/distances-overview.png)

## View options

The **View** dropdown lets you:

- **Show numbers** — overlay the raw distance value in each cell.
- **Color scheme** — pick **Warm**, **Cool**, **Green**, or **Grayscale**.

## Average distance

The right side of the status bar shows the average pairwise distance, which is a quick proxy for overall divergence within the alignment.

## Sequence order

Sequences appear in the same order as the MSA. Reordering in MSA or Tree view propagates here.

## Stale state

If you edit the alignment after building the tree, a warning bar appears at the top of the matrix. Rebuild the tree from the MSA view's Analyse menu to refresh.
