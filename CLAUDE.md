# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Acacia — Bioinformatics MSA & Phylogenetic Tree Viewer

A React/TypeScript web app for visualizing Multiple Sequence Alignments (MSA) and phylogenetic trees.

## Commands

- `npm run dev` — start dev server (Vite HMR)
- `npm run build` — type-check (`tsc -b`) then Vite build
- `npm run lint` — ESLint
- `npm run test` — Vitest (jsdom), all tests
- `npx vitest run src/tree/layout.test.ts` — run a single test file
- `npx vitest run -t "test name pattern"` — run tests matching a name

## Architecture

### State

Zustand stores only — no Context API for state, no Redux.

- `viewStore.ts` — which view is active. The tabs follow the analysis pipeline: MSA → Distances → Tree
- `sequenceStore.ts` — **cross-module**: the single source of truth for sequence display order and shared selection. Both the MSA renderer and the tree use this. Tree drag/reorder writes here; MSA reads here.
- `editStore.ts` — **cross-module**: undo/redo stack for MSA edits (rename, remove row, remove column). Edits are stored as a log against the original `MSAData`; `applyEdits()` in `editUtils.ts` replays them. Cmd+Z / Cmd+Shift+Z is wired via `useEditKeyboard` in MSA and inline in `tree/index.tsx`.
- `MSA/stores/msaStore.ts` — parsed sequence data
- `MSA/stores/drawStore.ts` — pan/zoom/color draw options
- `NJ/stores/njStore.ts` — distance-matrix and NJ-tree computation state. The two steps have separate status/error/params/stale fields: distances can be computed on their own, while a tree build publishes both
- `tree/stores/treeStore.ts` — tree display state (layout mode, pan/zoom, reroot, collapse, node styles, drag mode)

Context API is used **only for mutable DOM refs** that need to be shared across sibling hooks (see `src/MSA/context/CanvasContext.tsx` for canvas element refs). Never for state.

### Tree type pipeline

Three distinct types — never conflate them:

1. **`TreeNode`** (`tree/types.ts`) — raw recursive parse output from `parseNewick()`. Transient; discarded after flattening.
2. **`FlatTree`** (`tree/types.ts`) — the single source of truth stored in `treeStore`. A `Map<NodeId, FlatNode>` with stable string IDs (`"n0"`, `"n1"`, …) assigned in DFS preorder. All tree operations (reroot, rotate, drag-reorder) operate on `FlatTree`. IDs survive reroots and rotations. `originalRootId` / `isRerooted` support the "Reset root" feature.
3. **`LayoutNode`** (`tree/types.ts`) — computed by `buildLayout()` for rendering. Has `x`/`y` pixel coordinates and `angle` for radial. Rebuilt on every render from `FlatTree`; never mutated. `previewFlatTree` in the store holds a transient drag-preview tree that `buildLayout` is run on in parallel with the committed tree — the preview layout feeds `Branches` while labels stay on the committed layout.

Pipeline: `parseNewick → flattenTree → (treeStore.flatTree) → buildLayout → LayoutNode tree → Branches`

### Web Workers

CPU-heavy work runs off the main thread.

- `MSA/workers/canvasWorker.ts` — MSA canvas rendering (OffscreenCanvas)
- `MSA/workers/qualityWorker.ts` — TRIDENT + TCS column-quality scores
- `NJ/workers/njWorker.ts` — pairwise distances (`runDistances`) and the Neighbor-Joining algorithm (`runNJ`) via `@holmrenser/nj` (Rust/WASM, [`nj.rs`](https://github.com/holmrenser/nj)). `NJ/useAnalysis.ts` wraps both: it runs a step against the edited alignment, writes the result to `njStore`, and switches to the view that shows it

Worker message protocols are defined as discriminated union types in the module's `types.ts`. The worker lifecycle is managed by a dedicated hook (`useMainCanvasWorker`, `useQualityWorker`, `useNJWorker`).

### Rendering

Choose the rendering primitive based on the use case:

- **Canvas** — high-volume pixel rendering (MSA: potentially millions of cells). Uses OffscreenCanvas in a worker for the main render, plus a transparent overlay canvas on top for interaction (hover highlights, viewport box). Dual-canvas layers share the same dimensions with the overlay at a higher z-index.
- **SVG** — interactive discrete elements at low counts (Tree: ≤ ~1000 nodes). Per-element `onClick`, cursor, and hover are native; pan/zoom applied via `<g transform="translate(x,y) scale(z)">` without redrawing.

### Module layout

`src/MSA/`, `src/tree/`, and `src/NJ/` are independent feature modules. Each owns its types, components, hooks, stores, and utils. Cross-module communication goes through stores (`sequenceStore`, `editStore`), not imports.

Typical module structure:

```
ModuleName/
  types.ts            — all TypeScript types + worker message types
  stores/*Store.ts    — Zustand store(s)
  index.ts(x)         — public API: re-exports or the root component
  constants.ts        — module-level constants
  components/         — React components (PascalCase.tsx)
  hooks/              — custom hooks (useCamelCase.ts)
  utils/              — pure functions + co-located *.test.ts
  workers/*Worker.ts  — Web Workers (when CPU work is needed)
  context/            — React Context (DOM refs only, not state)
```

### Tests

Co-located `*.test.ts` files (e.g. `MSA/utils/fasta.test.ts`, `tree/layout.test.ts`). Pure utility functions and store logic are the primary test targets. Store tests use `useStore.setState({…})` in `beforeEach` to reset to a known fixture.

---

## Key conventions

- **Strict TypeScript** (`noUnusedLocals`, `noUnusedParameters`)
- **Tailwind + shadcn/ui** — primitives from `@/components/ui` (`<Button>`, `<DropdownMenu>`, `<Tabs>`, `<Slider>`, `<Switch>`, `<RadioGroup>`, `<Alert>`, `<Dialog>`, etc.). Prefer theme tokens (`bg-background`, `text-muted-foreground`, `border`, `text-destructive`) over arbitrary colors. Inline SVG for module icons; `lucide-react` for generic ones. Theme switching toggles `document.documentElement.classList` on/off `dark` — no `data-theme` attribute.
- **Custom shadcn variants** — `xs` size on `Button` and `Input`; `Alert` has a `warning` variant in addition to `default` / `destructive`. Extend the cva config in `src/components/ui/<component>.tsx` rather than overriding via `className`.
- **Toolbar pattern**: toolbar components (`MSAToolbar`, `TreeToolbar`) read from Zustand directly — no prop drilling. Use narrow selectors (`useStore((s) => s.x)`) so components re-render only on the slice they need.
- **No custom right-click menus** — overriding the browser context menu is an antipattern. Use click-triggered floating panels (popovers) instead: click element → `position: fixed` panel near cursor, closed by Escape or outside click.
- **Floating panels near cursor** (`BranchPanel`, `NodePanel`) — click-triggered, positioned at click coords (not anchored to a button). Keep the manual `popover="auto"` shell with `position: fixed` and style items with `bg-popover text-popover-foreground rounded-md border shadow-md`. Do NOT migrate these to shadcn `<Popover>` (it needs a real DOM trigger).
- **Data structures over serialization** — perform operations on in-memory data structures, not serialized text. E.g. `rerootTree(root: TreeNode, id: string): TreeNode` rather than parsing/serializing Newick mid-interaction.
- **Pan/zoom hook pattern**: attach to the target element via `useEffect`; read current state from `store.getState()` in event handlers (not reactive subscriptions) to avoid stale closures; write back via store actions.
