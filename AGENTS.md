# AGENTS.md

Guidance for coding agents working on Project Dashboard, an Obsidian plugin that renders a year-at-a-glance Gantt chart of project notes.

## Project overview

- TypeScript, bundled with esbuild into `main.js`, which is installed together with `manifest.json` and `styles.css`.
- `src/core/` holds pure logic with no Obsidian import: scanning notes (`scan.ts`), classification and category config (`config.ts`, `personal-rules.local.ts`), week-cell derivation (`cells.ts`), ISO week math (`weeks.ts`), preferences (`prefs.ts`), and change-detection rules (`sync-rules.ts`). `src/vault-source.ts` adapts the vault to that core; `src/view.ts` renders the tab; `src/main.ts` wires up the plugin.
- Specifications live in `openspec/specs/`, change proposals in `openspec/changes/`. This repository is developed spec-first with Spectra; see [CLAUDE.md](CLAUDE.md).

## Setup and commands

```bash
npm install
npm test          # vitest, must stay green
npm run lint       # eslint with the Obsidian plugin rules, must report 0 errors
npm run build      # type-check, then bundle to main.js
```

Run all three before proposing a change. `npm run build` is required before a release because `main.js` is a published asset. All four scripts (plus `npm run deploy`) run `scripts/ensure-local-rules.mjs` first, which creates `src/core/personal-rules.local.ts` from `personal-rules.example.ts` if missing — a fresh clone should never fail for lack of that file.

## Code style

- Tabs for indentation, single quotes, semicolons.
- Write comments that explain *why* a decision was made, not what the line does. Comment where the reason is not obvious from the code.
- Keep `src/core/*` free of any `obsidian` import so it stays unit-testable with plain vitest.
- Never commit real classification rules: `src/core/personal-rules.local.ts` and `deploy.local.json` are git-ignored on purpose. `vitest.config.ts` aliases the module to `personal-rules.example.ts` so tests never depend on it.

## Testing instructions

- Every behaviour change needs a test in `tests/`. Vault-dependent code (`vault-source.ts`, `view.ts`) is tested against the stub Obsidian classes in `tests/stubs/obsidian.ts`; keep new tests there free of real filenames or client names — use the neutral examples already in the fixtures.
- When a report contradicts the tests, check which build the user is actually running before changing code.

## Security and privacy

This repository is public, and releases install into other people's vaults. Before pushing, and again before each release:

- No paths from the author's private workspace anywhere in the tree, including generated blocks in specs: `grep -rn "300_專案\|200_Reference\|000_Agent\|chi_agent\|Obsidian Vault\|/Users/" . --exclude-dir=node_modules --exclude-dir=.git`
- No credentials: `grep -rniE "api[_-]?key|secret|token|password|ghp_" . --exclude-dir=node_modules --exclude=package-lock.json`
- No real client, company, or family names. The name list itself is private, so it lives in the git-ignored `.privacy-patterns.local` (one extended regex per line, maintainer machine only): `grep -rnE -f .privacy-patterns.local . --exclude-dir=node_modules --exclude-dir=.git --exclude=.privacy-patterns.local --exclude=personal-rules.local.ts --exclude=main.js`. Never copy those names into a tracked file, including this one.
- `src/core/personal-rules.local.ts` and `deploy.local.json` are the only files allowed to contain real folder names, keywords, or vault paths — both are git-ignored.
- The esbuild banner and any generated comment may name only the public repository URL, never a local path — that line ships inside `main.js`.
- Remove debugging probes and console logging before release.

## Release instructions

- Keep `manifest.json`, `package.json`, and `package-lock.json` on the same version.
- Tags carry no `v` prefix. Release notes are written in English first, then Traditional Chinese, and explain the cause of a fix rather than only the fix.
- Attach exactly `main.js`, `manifest.json`, and `styles.css` to the GitHub release.

## Release builds

`main.js` built on a maintainer machine bundles `src/core/personal-rules.local.ts`, which holds private classification rules. Never attach a locally built `main.js` to a GitHub Release. Build release assets from a fresh clone (where `npm install` creates `personal-rules.local.ts` from the example file), then confirm the bundle contains only the example rules before uploading.
