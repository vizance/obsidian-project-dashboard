# Project Vocabulary

This file is the canonical vocabulary for the dashboard project. Use these terms consistently across proposals, specs, design notes, code, and conversation.

## Canonical Terms

### `pending`

- **Definition**: A project that is waiting on an external trigger before becoming active — confirmation from a client, availability of a date, contract sign-off, or similar. Represented by `⏳` in Obsidian filenames.
- **Avoid**: `planned` (different meaning — see below), `waiting` (too generic).
- **Why**: `pending` precisely conveys "in queue, not yet committed to a schedule"; `planned` implies the decision has been made and only execution is left.

### `active`

- **Definition**: A project currently being executed. Tasks are in progress; the schedule is committed. Represented by `🚧` in Obsidian filenames, or no emoji prefix (default for new files).
- **Avoid**: `ongoing` (synonym, but `active` is shorter and matches the emoji's intent), `in-progress` (Spectra-reserved term for changes, avoid collision).
- **Why**: Single-word canonical term, mirrors the lifecycle of a Spectra change.

### `done`

- **Definition**: A project whose deliverable has been completed. Represented by `✅` in Obsidian filenames.
- **Avoid**: `completed` (verbose), `finished` (synonym).
- **Why**: One syllable, unambiguous, mirrors checkbox semantics.

### `cancelled`

- **Definition**: A project that was started or planned but explicitly stopped before completion. Represented by `❌` in Obsidian filenames.
- **Avoid**: `dropped`, `killed`, `aborted`.
- **Why**: Neutral, formal term suitable for retrospective records.

### `tentative`

- **Definition**: A property of a **bar segment** (not a project flag): any portion of a project's bar from `promised_end` onward to `end` is `tentative`. Rendered as a dashed border with transparent fill in the dashboard. When `promised_end` is `null`, the entire bar is tentative. Tentative no longer applies at project level and there is no manual list — the dashed visual is derived purely from task dates inside the note.
- **Avoid**: Treating `tentative` as a project-level flag in `projects.json`. Maintaining any hand-curated list of "tentative projects" (the manual-list approach was removed in favor of task-date derivation). `maybe`, `unconfirmed`, `未確定` as a status (use `tentative` as the technical term; `未確定` is fine in user-facing UI copy).
- **Why**: Anchors uncertainty to the actual evidence (scheduled task dates) rather than a hand-curated list. A segment is tentative iff no committed task date supports it.

### `promised_end`

- **Definition**: The latest ISO date found in a project note among all `📅 YYYY-MM-DD` and `✅ YYYY-MM-DD` occurrences. Marks the right edge of the project's scheduled metadata. `null` when the note contains no task dates.
- **Avoid**: Confusing with `end` (the user-declared promise from frontmatter / filename / default). Avoid conflating with `occupied` — `promised_end` uses raw task dates regardless of weekday, so a `📅 2026-02-21 (Sat)` contributes its raw `2026-02-21` value to `promised_end` (no bump), even though the same date bumps to the following ISO week for `occupied`.
- **Why**: Single source of truth for "how far the schedule has been committed on paper". Anchors right-edge calculations (including `overflow_end`) without entangling the per-week execution semantics that drive `occupied`.

### `occupied`

- **Definition**: A property of a **week cell**. A week is `occupied` for a project iff that week's ISO label is in the project's `occupied_weeks` set. `occupied_weeks` is derived per project from its task dates with the following weekday rules: Monday–Friday and Sunday → the date's own ISO week; Saturday → the ISO week of `d + 2 days` (the Monday of the following ISO week). No weekday is excluded; Saturday is the only weekday whose contribution is shifted. Occupied weeks render as solid filled blocks (category color in-range; warning red in overflow range); non-occupied in-range weeks render as dashed blocks; non-occupied weeks outside `[start, end]` are blank.
- **Avoid**: `busy`, `scheduled`, `active-week`, `loaded` — use `occupied` for the field name (`occupied_weeks`), the week-cell state, and in spec language. Avoid deriving `occupied` from any source other than the project's task dates (no frontmatter override, no manual list).
- **Why**: Honors the Obsidian workflow at the visual layer — Sat dates are buckets for next-week execution (hence the bump), while Fri dates are real work: the user plans on Friday and marks the upcoming week's tasks on that week's Friday for review, so a Friday date belongs to its own week and must occupy it. Earlier this rule excluded Friday on the assumption it was only a checkpoint reminder; that assumption was reversed once Friday became the user's primary planning-and-review day. Without per-weekday occupation, week-level idle gaps would be invisible inside a continuous bar.
- **Semantic evolution**: `occupied` still means "has a task date this week" and continues to govern whether a cell is filled at all. It no longer dictates the cell's *appearance* by itself — an occupied week is further split by completion into an outstanding state (renders as saturated solid) and a [[settled]] state (renders dimmed + ✅). The `occupied_weeks` field and its derivation are unchanged; the split layers on top via [[settled]].

### `settled`

- **Definition**: A property of a **week cell**: a week that is `occupied` and within `[start, end]` but whose every contributing task is complete. Completion is judged at the **task level** — a task is complete when its source line's checkbox is `[x]` OR the line contains a `✅` marker — and all dates a complete task contributes inherit that completion. Formally, `settled_weeks = occupied_weeks − weeks_derived_from_incomplete_task_dates`. A settled week renders as the project's category color at reduced opacity, overlaid with a checkmark glyph; it is NOT dashed or blank, so the "this week had tasks" record is preserved.
- **Avoid**: `done` (reserved for project lifecycle status), `completed`, `cleared`, `finished` as the field/term. Avoid judging completion per date marker (📅 vs ✅) — a task line with both a `📅` and a `✅` is complete, so the `📅` date MUST NOT make its week outstanding. Avoid representing settled with a distinct **hue** — completion is carried by the checkmark glyph + opacity, never a color.
- **Why**: Lets the user tell at a glance whether a filled week still demands time (saturated = outstanding) or is already cleared (dimmed + ✅ = settled), without losing the record that the week was scheduled. Anchoring completion to task-level state (not per-date) avoids misreading the common `📅 … ✅ …` two-date line as unfinished. Keeping completion orthogonal to hue means future categories never have to reserve a color for "done" — color stays reserved for category identity and the [[overflow]] warning only. When a week is both `settled` and in the [[overflow]] range, overflow wins (the scope-creep warning is a fact worth flagging even after the work is done).

### `overflow`

- **Definition**: A property of a **bar segment** and a derived data field. The `overflow_end` field is the maximum task date when it strictly exceeds the project's `end` AND the project's `status` is neither `done` nor `cancelled`; otherwise it is `null`. The **overflow segment** is the third bar segment type (alongside `solid` and `dashed`), drawn from `end` to `overflow_end` as a solid warning-colored fill, signalling scope creep so the user knows to update the frontmatter `預計結束日期`.
- **Avoid**: `creep`, `scope-creep`, `extension`, `late` as the canonical term — use `overflow` for the field name, segment class, and in spec language. Avoid extending `end` directly to include task dates beyond it (the data model intentionally keeps `end` as the user-declared promise).
- **Why**: Makes "the schedule actually grew past what was promised" visible at a glance without losing the original `end` value. Anchors the warning visual to real evidence (a task date in the note), and reuses the same `📅 / ✅ YYYY-MM-DD` data source that produces `promised_end`.

### `view-mode`

- **Definition**: A first-class user preference that selects how the gantt chart renders. Two values: `per-week` (per-ISO-week discrete cells reflecting task occupancy — see [[occupied]]) and `timeline` (one continuous solid-color bar per project from `start` to `max(end, overflow_end)`, no per-week breakdown, no overflow warning color). Toggled by the `T` keyboard shortcut. Persisted in `localStorage` under `dashboard.viewMode`.
- **Avoid**: `display-mode`, `chart-mode`, `gantt-mode`, `render-mode`. Use `view-mode` as the canonical noun phrase and the literal values `per-week` / `timeline` (kebab-case) in code, JSON, and spec text.
- **Why**: Treating "which view am I in" as a single named concept (rather than scattered `if` branches) keeps the rendering matrix predictable and gives future additions (e.g., new modes, mode-specific shortcuts) a single place to hook into.

### `help-panel`

- **Definition**: A static floating overlay that lists the dashboard's keyboard shortcuts and the meaning of each visual element (solid block, dashed block, overflow red, blank cell). Anchored top-right by `position: fixed`. Toggled by the `?` (or `/`) keyboard shortcut, by clicking its close button, or by clicking the persistent FAB (see [[help-fab]]). Auto-shown on the very first visit (tracked via `dashboard.helpFirstSeen`) and otherwise honors `dashboard.helpPanelOpen`.
- **Avoid**: `cheatsheet`, `tooltip`, `info-box`, `modal`, `dialog`. The `help-panel` is non-modal and never blocks interaction with the chart underneath.
- **Why**: Centralizes the explanation of every visual language and shortcut in one discoverable place, so per-element inline markers (e.g., a `⚠` glyph on every overflow cell) are not needed. Solves "the red color's meaning is not obvious" without adding per-cell visual noise.

### `help-fab`

- **Definition**: A small circular floating action button (FAB) anchored bottom-right by `position: fixed`, showing a `?` glyph. Visible whenever the [[help-panel]] is hidden; hidden whenever the panel is visible. Clicking it opens the panel.
- **Avoid**: `help-button`, `floating-button`, `info-icon`. Use `help-fab` (or just `FAB` in informal context) to disambiguate from other buttons in the UI.
- **Why**: Without a persistent reopen affordance, users who close the help panel and forget the `?` shortcut have no discoverable path back. The FAB is the always-available fallback entry point.

### `week-popover`

- **Definition**: A single floating overlay (`position: fixed`) opened by **clicking** a task-bearing week cell (a `.bar-solid` — including the settled variant — or `.bar-overflow` with a non-empty `title`). It shows that cell's existing `title` content (the [[occupied]] week's tasks as produced by `buildWeekTooltip`: project name, ISO week label, and one `✓`/`·` line per task), rendered via `textContent` + CSS `white-space: pre-line`. Belongs to the same floating-layer family as [[help-panel]] and [[help-fab]]. At most one exists at a time; dismissed by re-clicking the same cell, `Escape`, an outside click, or scroll.
- **Avoid**: `tooltip` (reserved for the native hover `title`), `modal`, `dialog-box`, `card`. The `week-popover` is non-modal and is the click-triggered counterpart to the native hover tooltip — both read the same `title`, so they never diverge.
- **Why**: The native hover tooltip is delayed, vanishes on pointer-move, and is absent on touch devices. The `week-popover` gives a persistent, instantly-readable, touch-friendly view of a week's tasks while reusing the exact same content source, so no data plumbing or content duplication is introduced. It coexists with — does not replace — the native tooltip.

### `closed`（已結案）

- **Definition**: A UI-only visual category that groups `done` + `cancelled` together for the purpose of fading them visually and providing a single show/hide control. It is NOT a lifecycle state in the data model — the underlying status remains `done` or `cancelled`.
- **Avoid**: Treating `closed` as a status in `scan_obsidian.py` or `projects.json`. The data model SHALL keep `done` and `cancelled` distinct.
- **Why**: The user mental model groups "no longer active" cases; the UI honors that without polluting the data layer.

## Principles

- **Lifecycle status vs commitment**: A project's record carries a **lifecycle status** (`pending` / `active` / `done` / `cancelled`) from its filename emoji, and a **`promised_end`** derived from task dates. Commitment is a property of bar SEGMENTS, not a project-level flag.
- **Reserve `planned` for future use**: If a future need arises for "decided to do, awaiting kickoff", the term `planned` MAY be introduced as a distinct status. Until then, `pending` covers all not-yet-active cases.
- **English in code, Traditional Chinese in UI copy**: The five canonical terms above are English in source code (variable names, JSON fields, class names). UI labels may use 「進行中」「待定」「已完成」「取消」「未確定」「已結案」as user-facing translations.
