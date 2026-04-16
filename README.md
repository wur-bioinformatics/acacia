# Acacia

A web app for visualizing multiple sequence alignments (MSA) and phylogenetic trees. Built with React and TypeScript.

## Features

- **MSA viewer** — renders large alignments efficiently using OffscreenCanvas in a Web Worker
- **Phylogenetic tree viewer** — interactive SVG tree with pan/zoom, reroot, and node collapse
- **Neighbor-Joining** — runs the NJ algorithm off the main thread via a dedicated worker
- **Combined view** — side-by-side MSA and tree

## Getting started

```bash
npm install
npm run dev
```

## Stack

- React + TypeScript (Vite)
- Zustand for state management
- Tailwind + DaisyUI
- [`nj.rs`](https://github.com/holmrenser/nj) (Rust/WASM) for Neighbor-Joining in the browser
