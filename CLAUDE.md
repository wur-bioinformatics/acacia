# Acacia — Bioinformatics MSA & Phylogenetic Tree Viewer

A React/TypeScript web app for visualizing Multiple Sequence Alignments (MSA) and phylogenetic trees.

## Commands

- `npm run dev` — start dev server (Vite HMR)
- `npm run build` — type-check (`tsc -b`) then Vite build
- `npm run lint` — ESLint
- `npm run test` — Vitest (jsdom)

## Architecture

### State

Zustand stores only — no Context API for state, no Redux.

- `viewStore.ts` — which view is active (MSA / Tree / Combined)
- `MSA/stores/msaStore.ts` — parsed sequence data
- `MSA/stores/drawStore.ts` — pan/zoom/color draw options
- `NJ/njStore.ts` — NJ algorithm computation state
- `tree/treeStore.ts` — tree display state (layout mode, pan/zoom, reroot, collapse, node styles)

Context API is used **only for mutable DOM refs** that need to be shared across sibling hooks (e.g. `CanvasContext` shares canvas element refs). Never for state.

### Web Workers

CPU-heavy work runs off the main thread.

- `MSA/canvasWorker.ts` — MSA canvas rendering (OffscreenCanvas)
- `NJ/njWorker.ts` — Neighbor-Joining algorithm via `@holmrenser/nj` (Rust/WASM, [`nj.rs`](https://github.com/holmrenser/nj))

Worker message protocols are defined as discriminated union types in the module's `types.ts`. The worker lifecycle is managed by a dedicated hook (`useMainCanvasWorker`, `useNJWorker`).

### Rendering

Choose the rendering primitive based on the use case:

- **Canvas** — high-volume pixel rendering (MSA: potentially millions of cells). Uses OffscreenCanvas in a worker for the main render, plus a transparent overlay canvas on top for interaction (hover highlights, viewport box). Dual-canvas layers share the same dimensions with the overlay at a higher z-index.
- **SVG** — interactive discrete elements at low counts (Tree: ≤ ~1000 nodes). Per-element `onClick`, cursor, and hover are native; pan/zoom applied via `<g transform="translate(x,y) scale(z)">` without redrawing.

### Module layout

`src/MSA/`, `src/tree/`, and `src/NJ/` are independent feature modules. Each owns its types, components, hooks, stores, and utils. Cross-module communication goes through stores, not imports.

Typical module structure:

```
ModuleName/
  types.ts          — all TypeScript types + worker message types
  *Store.ts         — Zustand store(s)
  index.ts(x)       — public API: re-exports or the root component
  constants.ts      — module-level constants
  components/       — React components (PascalCase.tsx)
  hooks/            — custom hooks (useCamelCase.ts)
  utils/            — pure functions + co-located *.test.ts
  *Worker.ts        — Web Worker (when CPU work is needed)
  context/          — React Context (DOM refs only, not state)
```

### Tests

Co-located `*.test.ts` files (e.g. `MSA/utils/fasta.test.ts`, `tree/layout.test.ts`). Pure utility functions and store logic are the primary test targets.

---

## Key conventions

- **Strict TypeScript** (`noUnusedLocals`, `noUnusedParameters`)
- **Tailwind + DaisyUI** for UI components; avoid raw inline styles
- **Custom logic in hooks** — keep components thin; complex event handling and side effects belong in hooks
- **React hooks lint rules** enforced; respect exhaustive-deps
- **Toolbar pattern**: toolbar components (`MSAToolbar`, `TreeToolbar`) read from Zustand directly — no prop drilling for toolbar state
- **No custom right-click menus** — overriding the browser context menu is an antipattern. Use click-triggered floating panels (popovers) instead: click element → `position: fixed` panel near cursor, closed by Escape or outside click
- **Data structures over serialization** — perform operations on in-memory data structures, not serialized text. E.g. `rerootTree(root: TreeNode, id: string): TreeNode` rather than parsing/serializing Newick mid-interaction
- **Pan/zoom hook pattern**: attach to the target element via `useEffect`, read current state from `store.getState()` in event handlers (not reactive subscriptions) to avoid stale closures, write back via store actions
- **Short and readable** — prefer concise expressions over verbose ones. Keep functions focused and small. Avoid intermediate variables that add no clarity. No over-abstraction: don't create helpers for one-off use, don't design for hypothetical reuse.
- **Performance** — use narrow Zustand selectors (`useStore((s) => s.x)` not `useStore()`) so components only re-render on the slice they need. Use `useMemo` for expensive derived values (layout computation, filtered sequences); `useCallback` for handlers that are passed down or captured in refs. In event handlers, read current state from `store.getState()` — never from reactive subscriptions — to avoid stale closures.
- **Clean UI aesthetics** — DaisyUI semantic components first (`btn`, `menu`, `input`, `tabs`, `join`, etc.), then Tailwind utilities. Use DaisyUI theme tokens (`bg-base-100/200/300`, `text-base-content`, `border-base-300`) instead of arbitrary colors. Use `opacity-50 hover:opacity-100 transition-opacity` for muted/hover states. Inline SVG paths for icons — no icon library. Consistent spatial rhythm: `gap-2`, `px-1`, `rounded-box`.
