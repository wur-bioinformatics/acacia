# Screenshot E2E tests

Drives the running dev server through known UI states and captures PNGs into `public/docs-assets/`. The Markdown content in `src/docs/content/*.md` references those PNGs by absolute path.

## When to run

If you change anything visible in a toolbar, panel, or canvas that appears in a screenshot, run:

```
npm run screenshots
```

and commit the diff. The contract test in `src/docs/docsContract.test.ts` will fail in `npm test` if Markdown references an image that no longer exists.

## One-time setup

```
npm run screenshots:install
```

downloads the headless Chromium build (~170 MB cache in `~/Library/Caches/ms-playwright/`).

## Running

```
npm run screenshots        # all specs
npx playwright test -c tests/e2e/playwright.config.ts msa.spec.ts
```

The Playwright config boots the dev server itself with `webServer`. If a dev server is already running on `:5173`, it is reused.
