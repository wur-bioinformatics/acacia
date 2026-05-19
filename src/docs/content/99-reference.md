# Reference

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| **Cmd+Z** / **Ctrl+Z** | Undo (MSA and Tree) |
| **Cmd+Shift+Z** / **Ctrl+Shift+Z** | Redo (MSA and Tree) |
| **Delete** / **Backspace** | Remove selected row or column (MSA) |
| **Escape** | Clear column selection (MSA) |

## File formats

- **FASTA** — for sequence alignments. Both DNA and protein alignments are supported. The sequence type is auto-detected from the residue alphabet.
- **Newick** — for trees. Bootstrap values are read from internal node labels; branch lengths are read from the `:value` suffix.

## Performance notes

- The MSA canvas runs in an **OffscreenCanvas Web Worker**, so very large alignments do not block the UI thread.
- Tree rendering uses **SVG** with one DOM element per node and branch. This is comfortable up to ~1000 leaves; beyond that, expect interaction to slow down.
- Neighbor-joining is implemented in Rust/WASM via [`nj.rs`](https://github.com/holmrenser/nj) and also runs in a Web Worker.

## Privacy

Acacia is a pure client-side application. Sequence data, alignments, and trees stay in your browser — nothing is uploaded.
