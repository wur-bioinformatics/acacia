# Exporting

## Tree exports

From the Tree toolbar's **File → Export** menu:

- **SVG** — vector graphic of the current view, ideal for figures.
- **PNG** — raster image at the current zoom level.
- **Newick** — the tree in standard [Newick format](https://en.wikipedia.org/wiki/Newick_format), reflecting any rerooting and collapsing.

```text
((seq1:0.1,seq2:0.2):0.3,(seq3:0.15,seq4:0.25):0.35);
```

## Alignment edit log

The MSA toolbar's undo/redo group includes an export button that downloads every edit (renames, removals, reorderings) as JSON:

```json
{
  "edits": [
    { "type": "remove-row", "id": "seq3" },
    { "type": "rename", "id": "seq1", "newName": "ortholog-A" },
    { "type": "remove-column", "index": 42 }
  ]
}
```

Re-importing this JSON applies the same edits on top of the same original alignment, so any analysis is reproducible.
