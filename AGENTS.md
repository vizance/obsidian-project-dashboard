# AGENTS.md

Guidance for coding agents working on Project Dashboard, an Obsidian plugin that renders a year-at-a-glance Gantt chart of project notes.

## Project overview

- TypeScript, bundled with esbuild into `main.js`, which is installed together with `manifest.json` and `styles.css`.
- `src/core/` holds pure logic with no Obsidian import: scanning and classification (`scan.ts`), category definitions (`config.ts`), the settings model with its defaults and per-field validation (`settings.ts`), the plugin-data store that loads, debounces, and saves the whole data object (`plugin-data-store.ts`), week-cell derivation (`cells.ts`), ISO week math including the Saturday rule (`weeks.ts`), task-line reading and the schedule date (`task-lines.ts`), preferences (`prefs.ts`), and change-detection rules (`sync-rules.ts`). No build-time rules file exists any more: every user-configurable value comes from the settings stored in plugin data. `src/vault-source.ts` adapts the vault to that core; `src/view.ts` renders the tab; `src/settings-tab.ts` is the Obsidian settings tab; `src/main.ts` wires up the plugin and connects `loadData`/`saveData`/`onExternalSettingsChange` to the store.
- Specifications live in `openspec/specs/`, change proposals in `openspec/changes/`. This repository is developed spec-first with Spectra; see [CLAUDE.md](CLAUDE.md).

## Setup and commands

```bash
npm install
npm test          # vitest, must stay green
npm run lint       # eslint with the Obsidian plugin rules, must report 0 errors
npm run build      # type-check, then bundle to main.js
```

Run all three before proposing a change. `npm run build` is required before a release because `main.js` is a published asset. None of these scripts reads or creates a git-ignored source file, so a fresh clone builds, tests, and lints as-is.

## Code style

- Tabs for indentation, single quotes, semicolons.
- Write comments that explain *why* a decision was made, not what the line does. Comment where the reason is not obvious from the code.
- Keep `src/core/*` free of any `obsidian` import so it stays unit-testable with plain vitest.
- Never put real rules in the tree: real folder names, keywords, and vault paths belong only in the user's plugin data (configured through the settings tab, inside the vault) and in the git-ignored `deploy.local.json`. Code, tests, specs, and defaults use the neutral examples.

## Testing instructions

- Every behaviour change needs a test in `tests/`. Vault-dependent code (`vault-source.ts`, `view.ts`) is tested against the stub Obsidian classes in `tests/stubs/obsidian.ts`; keep new tests there free of real filenames or client names — use the neutral examples already in the fixtures.
- When a report contradicts the tests, check which build the user is actually running before changing code.

## Security and privacy

This repository is public, and releases install into other people's vaults. Before pushing, and again before each release:

- No paths from the author's private workspace anywhere in the tree, including generated blocks in specs: `grep -rn "300_專案\|200_Reference\|000_Agent\|chi_agent\|Obsidian Vault\|/Users/" . --exclude-dir=node_modules --exclude-dir=.git`
- No credentials: `grep -rniE "api[_-]?key|secret|token|password|ghp_" . --exclude-dir=node_modules --exclude=package-lock.json`
- No real client, company, or family names. The name list itself is private, so it lives in the git-ignored `.privacy-patterns.local` (one extended regex per line, maintainer machine only): `grep -rnE -f .privacy-patterns.local . --exclude-dir=node_modules --exclude-dir=.git --exclude=.privacy-patterns.local --exclude=main.js`. Never copy those names into a tracked file, including this one.
- `deploy.local.json` is the only file in the tree allowed to contain a real vault path, and it is git-ignored. Real folder names and classification keywords live in the plugin data inside the maintainer's vault, which is outside this repository — never paste them into source, tests, specs, or a changelog.
- The esbuild banner and any generated comment may name only the public repository URL, never a local path — that line ships inside `main.js`.
- Remove debugging probes and console logging before release.

## Release instructions

- Keep `manifest.json`, `package.json`, and `package-lock.json` on the same version.
- Tags carry no `v` prefix. Release notes are written in English first, then Traditional Chinese, and explain the cause of a fix rather than only the fix.
- Attach exactly `main.js`, `manifest.json`, and `styles.css` to the GitHub release.

## Release builds

Since 0.3.0 the bundle contains no private rules: every configurable value is read from the plugin data in the user's vault at runtime, so `main.js` is the same wherever it is built. Build release assets from a fresh clone anyway, so that no local experiment, stray file, or uncommitted change can reach a published asset, and confirm the bundle before uploading.
