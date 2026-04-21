# End-to-end tests (Playwright)

Smoke tests covering the full register → 2FA → login → fill → compute → review
flow against a real browser + dev server.

## First-time setup

```
npx playwright install chromium
```

## Run

```
npm run test:e2e          # headless
npm run test:e2e:ui       # interactive UI mode
```

The `playwright.config.ts` `webServer` block boots `npm run dev` on port 3100
against `${tmpdir}/tax-app-e2e` so the suite is hermetic. Drop that directory
between runs for a fully clean state.

## Why these tests exist

The unit + integration suite (vitest) mounts components and stubs APIs. It
does NOT catch:
- CSRF / CORS / cookie flag issues (hit real HTTP stack)
- CSP, asset loading, Vite pipeline
- Browser-level regressions (dropdowns that don't open, Vuetify teleport
  breakage, focus traps)
- End-to-end auth flows wiring (register → code email → verify → session)

One Playwright smoke catches all of these in one pass.
