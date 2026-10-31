## MODIFIED Requirements

### Requirement: Render bar continuously in timeline view mode

When the year view is shown and the dashboard's active view mode is `timeline`, each visible project's bar SHALL render as a single continuous solid-color block spanning from the week containing `start` to the week containing `max(end, overflow_end)`. The block SHALL use the project's category color. The block MUST NOT be split into per-week cells, MUST NOT render dashed segments for idle weeks, and MUST NOT render warning-red overflow segments. The block MUST sit in the same row as the project's name and span the appropriate week cells using the existing absolute-positioned bar technique (one `<div>` per project row with width = N cells * 100% - small padding).

For projects where `overflow_end` is null, the right edge SHALL be the week containing `end`. For projects with non-null `overflow_end`, the right edge SHALL be the week containing `overflow_end` (the later of the two).

For projects whose `status` is `done` or `cancelled`, the continuous block SHALL still render but with the existing `.bar.done` / `.bar.cancelled` grayscale + opacity 0.35 styling applied.

For projects whose `start` or `end` is null, no bar SHALL render in timeline view (mirroring the per-week view's filter behavior). The month view SHALL NOT use the timeline rendering.

#### Scenario: Timeline mode renders single continuous bar

- **GIVEN** the dashboard's `viewMode` is `'timeline'`
- **AND** a project with `start = 2026-01-05`, `end = 2026-04-30`, `overflow_end = null`, `status = active`
- **WHEN** the frontend renders this project
- **THEN** exactly one `<div class="bar bar-solid ...">` MUST appear in that project's row
- **AND** the div's left edge MUST align with the week containing `2026-01-05` (W2)
- **AND** the div's right edge MUST align with the week containing `2026-04-30` (W18)
- **AND** no dashed blocks, no per-week gaps, no red blocks MUST appear in that row

#### Scenario: Timeline mode extends to overflow_end when present

- **GIVEN** `viewMode = 'timeline'`
- **AND** a project with `start = 2026-01-05`, `end = 2026-04-30`, `overflow_end = 2026-05-21`, `status = active`
- **WHEN** the frontend renders this project
- **THEN** the single bar's right edge MUST align with the week containing `2026-05-21` (W21)
- **AND** the bar MUST be entirely in the project's category color (no red segment for the W19-W21 range)

#### Scenario: Timeline mode applies grayscale to closed projects

- **GIVEN** `viewMode = 'timeline'`
- **AND** a project with `start = 2026-01-01`, `end = 2026-01-31`, `status = done`
- **WHEN** the frontend renders this project (with "顯示已結案" checked)
- **THEN** the single bar MUST render with the `.done` (or `.cancelled` for cancelled) CSS class applied
- **AND** the resulting visual MUST have grayscale filter + opacity 0.35

#### Scenario: Timeline mode skips projects missing start or end

- **GIVEN** `viewMode = 'timeline'`
- **AND** a project where either `start` or `end` is null
- **WHEN** the frontend renders this project
- **THEN** no bar MUST render in that project's row (the row remains visible with the project name but no gantt bar)
