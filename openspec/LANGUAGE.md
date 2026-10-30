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
- **Avoid**: Treating `tentative` as a project-level flag in the scanned project record. Maintaining any hand-curated list of "tentative projects" (the manual-list approach was removed in favor of task-date derivation). `maybe`, `unconfirmed`, `未確定` as a status (use `tentative` as the technical term; `未確定` is fine in user-facing UI copy).
- **Why**: Anchors uncertainty to the actual evidence (scheduled task dates) rather than a hand-curated list. A segment is tentative iff no committed task date supports it.

### `promised_end`

- **Definition**: The latest ISO date found in a project note among all `📅 YYYY-MM-DD` and `✅ YYYY-MM-DD` occurrences. Marks the right edge of the project's scheduled metadata. `null` when the note contains no task dates.
- **Avoid**: Confusing with `end` (the user-declared promise from frontmatter / filename / default). Avoid conflating with `occupied` — `promised_end` uses raw task dates regardless of weekday, so a `📅 2026-02-21 (Sat)` contributes its raw `2026-02-21` value to `promised_end` (no bump), even though the same date bumps to the following ISO week for `occupied` while the [[Saturday rule]] is on.
- **Why**: Single source of truth for "how far the schedule has been committed on paper". Anchors right-edge calculations (including `overflow_end`) without entangling the per-week execution semantics that drive `occupied`.

### `occupied`

- **Definition**: A property of a **week cell**. A week is `occupied` for a project iff that week's ISO label is in the project's `occupied_weeks` set. `occupied_weeks` is derived per project from its task dates: every date maps to its own ISO week, except that a Saturday maps to the ISO week of `d + 2 days` (the Monday of the following ISO week) when the [[Saturday rule]] is on. No weekday is ever excluded, and Saturday is the only weekday whose contribution can shift; with the Saturday rule off (the default) every date, Saturday included, maps to its own ISO week. The mapping has one implementation, `weekOfTaskDate(date, rules)` in `src/core/weeks.ts`, which every caller (scan, cells, tooltip, [[week-popover]]) passes the current rules to. Occupied weeks render as solid filled blocks (category color in-range; warning red in overflow range); non-occupied in-range weeks render as dashed blocks; non-occupied weeks outside `[start, end]` are blank.
- **Avoid**: `busy`, `scheduled`, `active-week`, `loaded` — use `occupied` for the field name (`occupied_weeks`), the week-cell state, and in spec language. Avoid deriving `occupied` from any source other than the project's task dates (no frontmatter override, no manual list). Avoid describing the Saturday shift as unconditional, and avoid re-implementing the weekday mapping beside `weekOfTaskDate`.
- **Why**: Honors the Obsidian workflow at the visual layer — for a user who plans on Saturday, a Sat date is a bucket for next-week execution (hence the bump), while Fri dates are real work: that user plans on Friday and marks the upcoming week's tasks on that week's Friday for review, so a Friday date belongs to its own week and must occupy it. Earlier this rule excluded Friday on the assumption it was only a checkpoint reminder; that assumption was reversed once Friday became the user's primary planning-and-review day. The Saturday bump was unconditional in 0.1.0 and 0.2.0 for the same reason, but it reflects one person's planning habit, so 0.3.0 made it the [[Saturday rule]] setting and defaults it to off. Without per-weekday occupation, week-level idle gaps would be invisible inside a continuous bar.
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

- **Definition**: A single floating overlay (`position: fixed`) opened by clicking a project's drawn week cell in the `per-week` [[view-mode]]: a solid cell (including the [[settled]] variant), an [[overflow]] cell, an in-range dashed cell, or the dashed span of a project without task dates (for the span, the clicked week is computed from the click position). It lists the week's [[task line]]s, each with a checkbox, a date label, `◀` `▶` to move the task by one week, and `↗` to jump to that line in the note, plus two footer entries: pick an [[unscheduled task]] for this week, or add a new task; both write the [[schedule date]]. Every edit goes through one task writer that re-checks the line against the note before saving. Built with DOM element APIs. At most one exists at a time, and after a re-render it re-opens on the same note and ISO week. In the `timeline` view-mode it stays a read-only view of the bar's `title` text. Dismissed by re-clicking the same cell (or the same week of a dashed span), `Escape` while focus is outside its text input, an outside click, `↗`, or a scroll that moves its anchor cell (the chart, the dashboard tab, or the document).
- **Avoid**: `tooltip` (reserved for the native hover `title`), `modal`, `dialog-box`, `card`. The `week-popover` is non-modal, and the native hover tooltip still exists and lists the same tasks.
- **Why**: Weekly planning happens while looking at the chart: seeing a week and adjusting it in the same place saves hopping between the chart and a dozen notes. The popover only edits the project note itself, so the note stays the single store of tasks and the chart, the note, and the Tasks plugin never disagree. It belongs to the same floating-layer family as [[help-panel]] and [[help-fab]].

### `task line`

- **Definition**: One line of a project note that the dashboard can show as a task: a checkbox task (optional indentation, a `-`, `*`, or `+` bullet, then `[ ]`, `[x]`, or `[X]`) or any line carrying at least one `📅`/`✅` ISO date. Exposed per project as `task_lines`, each with its 0-based line index at scan time, the raw text, the display text, `checkbox`, `done`, `recurring`, `due` (first `📅`), `doneDate` (first `✅`), and every date on the line in order. Only checkbox task lines can be ticked, moved, or scheduled; a dated line without a checkbox, or with a custom status such as `[/]`, is shown read-only.
- **Avoid**: `task` alone when line identity matters: an entry of `tasks` (`TaskEntry`) is one *date*, so a line with both `📅` and `✅` gives two entries but one task line. Also avoid `todo`, `item`, and `row` (a row is the popover's visual row for a task line).
- **Why**: Editing a note needs a handle on one *line*, not one date. Keeping `task_lines` beside the per-date `tasks` lets the task writer target exactly one line while every existing week and bar calculation stays untouched.

### `unscheduled task`

- **Definition**: A [[task line]] that is a checkbox task, is not done, and carries no `📅`/`✅` date. These are the candidates the [[week-popover]] offers under `＋ 從還沒排日期的任務挑一個（N）`, listed in note order.
- **Avoid**: `undated task`, `backlog`, `inbox` (the latter is a common vault folder name).
- **Why**: The weekly planning step is "pick from what is still open and give it a week". Naming that pool makes the step a first-class concept instead of a filter hidden in UI code.

### `schedule date`

- **Definition**: The date written when a task is placed into an ISO week from the [[week-popover]], either by scheduling an [[unscheduled task]] or by adding a new task: that week's Monday plus `scheduleWeekday − 1` days, where `scheduleWeekday` is the `Which day to write`（排進某週時寫星期幾）setting, 1 (Monday) to 7 (Sunday), default 5 (Friday). One exception: when `scheduleWeekday` is 6 (Saturday) and the [[Saturday rule]] is on, the date is the Saturday before that week's Monday (the Monday minus 2 days), because that Saturday is the date the [[occupied]] mapping puts in the chosen week. Under every combination of the two settings the written date therefore maps back to the week the user picked. Moving a task with `◀` / `▶` is not scheduling; it shifts the line's first `📅` date by 7 days and keeps its weekday.
- **Avoid**: `due date` for this specific value (`due` is whatever `📅` date a line carries, which the user may set to any day), `deadline`. Avoid calling the Friday a fixed rule — it is the default of a setting.
- **Why**: A scheduled task should look like one the user wrote by hand, and which weekday that is depends on when the user plans; the maintainer plans on Friday and marks next week's tasks with that week's Friday (see [[occupied]] → Why), which is why Friday is the default. The rule lives in one place (`scheduleDateForWeek` in `src/core/task-lines.ts`), which is also where the Saturday exception is kept, so the guarantee "the task appears in the week you picked" is verifiable in a single function.

### `settings tab`（設定頁）

- **Definition**: The plugin's own tab under Obsidian's Settings (Settings → Project Dashboard), registered with `PluginSettingTab` and built in `src/settings-tab.ts`. Its copy is plain English a fifth-grade student can read, while the dashboard itself (year view and [[week-popover]]) stays Traditional Chinese, and it holds three sections: `Project notes`（專案筆記）with `Project folder` and `Projects to skip`, `Categories`（分類）with the ordered list of [[classification rule]]s, and `Dates`（日期規則）with `Which day to write` and the [[Saturday rule]]. Every value it shows belongs to one `DashboardSettings` object stored in the vault's plugin data under the key `settings`, beside `categoryOverrides`; each write replaces the whole plugin-data object, a burst of edits is saved once 400 ms after the last one, and after a successful save every open dashboard re-scans and re-renders.
- **Avoid**: `preferences` (reserved for the `localStorage`-backed, per-device values in `src/core/prefs.ts`, such as [[view-mode]]), `options page`, `config screen`, `settings panel` (the floating-layer family uses `panel` — see [[help-panel]]). Avoid saying settings are configured in source or in a build-time file; nothing in the repository holds a user's values.
- **Why**: One named place for "what the user can configure" separates it from the per-device preferences and from the category definitions that remain in code, and makes the data path unambiguous: the settings tab is the only editor of `settings`, the plugin data is the only store, and the dashboard reads it through the store.

### `classification rule`（分類規則）

- **Definition**: One entry of the `classificationRules` setting, `{ text, category }`: a project whose name contains `text` is classified as `category`. The list is ordered, and classification walks it from the top and takes the first match, so a longer word must sit above a shorter word it contains (`企業內訓` above `內訓`). A rule whose `text` is empty is stored and shown as a row but takes no part in classification. The full classification order is: exact-name override → first matching classification rule → `other`.
- **Avoid**: `keyword rule` and `manual override fragment` as separate concepts — 0.3.0 merged both into this single ordered list (the manual fragments became the rules placed above the keyword ones). Keep `override` for the exact-name entries of `categoryOverrides`, which are set on the dashboard and win over every rule; avoid `filter` (that is the `Projects to skip`（不列入的專案）setting).
- **Why**: Two lists that both meant "name contains this text → this category" and differed only in matching order showed up as two identical-looking tables and one more thing to remember. An explicit order makes priority visible and movable (`Move up` / `Move down`) instead of implicit in which list a rule happened to live in. Empty rules are kept so a row the user just added survives a save.

### `Saturday rule`（週六算下一週）

- **Definition**: The `saturdayCountsAsNextWeek` setting, shown as `Saturday tasks count for next week`（週六的任務算到下一週）and off by default. When it is on, a task date that falls on a Saturday is mapped to the following ISO week for [[occupied]] (chart cells, tooltip, and [[week-popover]] alike) and the [[schedule date]] for a Saturday choice becomes the Saturday before the week's Monday. When it is off, a Saturday date behaves like any other weekday. `promised_end` and `overflow_end` are never affected: they use raw task dates under both settings.
- **Avoid**: `Saturday bump`, `weekend rule`, `Sat shift` as the canonical term, and describing the shift as the plugin's fixed behaviour. Avoid applying it to anything other than the week mapping and the schedule date.
- **Why**: Treating a Saturday date as "the work I set up for next week" is one person's planning habit, not general behaviour, so it has to be nameable and switchable; naming it keeps the two places it reaches (week mapping, schedule date) tied to one concept, and defaulting it off means a new user sees dates where they wrote them.

### `closed`（已結案）

- **Definition**: A UI-only visual category that groups `done` + `cancelled` together for the purpose of fading them visually and providing a single show/hide control. It is NOT a lifecycle state in the data model — the underlying status remains `done` or `cancelled`.
- **Avoid**: Treating `closed` as a status in the scanner or the scanned project record. The data model SHALL keep `done` and `cancelled` distinct.
- **Why**: The user mental model groups "no longer active" cases; the UI honors that without polluting the data layer.

## Principles

- **Lifecycle status vs commitment**: A project's record carries a **lifecycle status** (`pending` / `active` / `done` / `cancelled`) from its filename emoji, and a **`promised_end`** derived from task dates. Commitment is a property of bar SEGMENTS, not a project-level flag.
- **Reserve `planned` for future use**: If a future need arises for "decided to do, awaiting kickoff", the term `planned` MAY be introduced as a distinct status. Until then, `pending` covers all not-yet-active cases.
- **English in code, Traditional Chinese in UI copy**: The five canonical terms above are English in source code (variable names, JSON fields, class names). UI labels may use 「進行中」「待定」「已完成」「取消」「未確定」「已結案」as user-facing translations. The [[settings tab]] is the exception: it is plugin-level, so its copy is plain English.
