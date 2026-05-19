# Contributing

## Development setup

Prerequisites: Node 20+

```bash
npm install
npm run dev
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then build for production |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest |

Always run `npm run lint` and `npm run test` before opening a PR — CI enforces both.

## Architecture

The app is split into three independent feature modules: `src/MSA/` (canvas-based alignment viewer), `src/tree/` (SVG tree), and `src/NJ/` (Neighbor-Joining algorithm via Rust/WASM). State lives in Zustand stores; CPU-heavy work runs in Web Workers. See [CLAUDE.md](CLAUDE.md) for the full architecture and module layout reference.

## Code conventions

- **TypeScript strict** — `noUnusedLocals` and `noUnusedParameters` are enforced; fix all type errors before committing
- **Zustand selectors** — select only the slice you need (`useStore((s) => s.x)`), not the whole store
- **Canvas vs SVG** — use Canvas (OffscreenCanvas in a worker) for high-volume pixel rendering; use SVG for discrete interactive elements (≤ ~1000 nodes)
- **Module boundaries** — cross-module communication goes through stores, not direct imports between `MSA/`, `tree/`, and `NJ/`
- **UI** — DaisyUI semantic components first, then Tailwind utilities; use theme tokens (`bg-base-100`, `text-base-content`, etc.) instead of arbitrary colors; no icon libraries; no custom right-click menus
- **Tests** — co-locate test files as `*.test.ts` next to the module they test; focus on pure utility functions and store logic

## Documentation

User-facing documentation lives in `src/docs/content/*.md` and renders inside the app as a side-sheet (opened by the `?` icon in the header). When you add or change a user-visible feature:

- Update the relevant Markdown section in `src/docs/content/`.
- If you add a new toolbar or floating panel, drop a `<HelpButton anchor="…">` into it and add a matching heading in the docs.
- If visuals changed, regenerate screenshots:
  ```bash
  npm run screenshots:install   # one-time, downloads Chromium
  npm run screenshots
  ```
  Commit the PNG diff under `public/docs-assets/`.

The `docsContract.test.ts` Vitest test enforces three invariants:

- every `![…](/docs-assets/foo.png)` reference resolves to a file in `public/docs-assets/`,
- every `<HelpButton anchor="…">` and `openDocs("…")` anchor resolves to a heading slug in the rendered docs,
- the three main toolbar surfaces each mount at least one `<HelpButton>`.

## Submitting changes

1. Fork the repo and create a feature branch off `main`
2. Make your changes, keeping each PR focused on a single concern
3. Open a PR against `main` — CI will run lint and tests automatically
4. The PR can be merged once CI passes

## Releases & deployment

Deployment to GitHub Pages is triggered by pushing a semver tag:

```bash
git tag v1.2.0
git push origin v1.2.0
```

The pipeline runs lint → test → build → deploy in sequence; build only proceeds if tests pass. Manual deploys can also be triggered via `workflow_dispatch` on the deploy workflow.
