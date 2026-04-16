# Acacia

A web app for visualizing multiple sequence alignments (MSA) and phylogenetic trees. Built with React and TypeScript.

[![Test](https://github.com/wur-bioinformatics/acacia/actions/workflows/test.yml/badge.svg)](https://github.com/wur-bioinformatics/acacia/actions/workflows/test.yml)
[![Deploy to GitHub Pages](https://github.com/wur-bioinformatics/acacia/actions/workflows/deploy.yml/badge.svg)](https://github.com/wur-bioinformatics/acacia/actions/workflows/deploy.yml)

## Features

- **MSA viewer** — renders large alignments efficiently using OffscreenCanvas in a Web Worker
- **Phylogenetic tree viewer** — interactive SVG tree with pan/zoom, reroot, and node collapse
- **Neighbor-Joining** — runs the NJ algorithm off the main thread via a dedicated worker (which in turn uses [nj.rs](https://github.com/holmrenser/nj.rs))
- **Combined view** — side-by-side MSA and tree (Not implemented yet)
- **Distances** - All pairwise distances according to a selected substitution model.

## Running locally

(Needs Node >= 20 and corresponding NPM)

```bash
git clone https://github.com/wur-bioinformatics/acacia
cd acacia
npm install
npm run dev
```

## Stack

- React + TypeScript (Vite)
- Zustand for state management
- Tailwind + DaisyUI
- [`nj.rs`](https://github.com/holmrenser/nj) (Rust/WASM) for Neighbor-Joining in the browser
