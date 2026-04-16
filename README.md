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

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest |

## Stack

- React + TypeScript (Vite)
- Zustand for state management
- Tailwind + DaisyUI
- [`nj.rs`](https://github.com/holmrenser/nj) (Rust/WASM) for Neighbor-Joining in the browser
