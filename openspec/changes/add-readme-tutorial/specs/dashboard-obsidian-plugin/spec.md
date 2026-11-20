## ADDED Requirements

### Requirement: README teaches setup and everyday use

The repository SHALL have two README files with the same content: `README.md` in English and `README.zh-TW.md` in Traditional Chinese, each linking to the other in its first lines. Each SHALL be written as a step-by-step tutorial in plain language, in this order: what the plugin is, with a screenshot of the dashboard; installing with BRAT and manually; first-time setup (the project folder, the frontmatter fields a project note uses, and how task dates are written); the year view, the week popover, the month view, and the `還沒排` column; the calendar General row; paused projects and changing a project's status; the settings tab; network use; bundled third-party code; further reading; and a short development section. Every screenshot SHALL be stored under `docs/images/` and SHALL show only neutral example data — no real note, person, client, or calendar. The detailed behaviour rules that do not fit a tutorial SHALL be kept in `docs/details.md` and `docs/details.zh-TW.md`, linked from the README sections they belong to.

The further-reading section SHALL link to these articles on the author's website, and the English README SHALL say that they are written in Traditional Chinese:

- `https://chichu.co/blog/5-levels-personal-project-management`
- `https://chichu.co/blog/8-steps-using-google-sheet-to-design-your-monthly-plan`
- `https://chichu.co/blog/3-steps-using-muji-vertical-planner`
- `https://chichu.co/blog/10-steps-using-obsidian-to-build-a-personal-project-management-system`
- `https://chichu.co/blog/obsidian-claudian-project-note`
- `https://chichu.co/blog/how-to-use-obsidian-to-manage-personal-project`

The screenshots SHALL be produced by a script under `scripts/screenshots/` that renders the plugin's own view code with built-in example projects and an example calendar, so that a maintainer can re-create every image after a UI change.

#### Scenario: Both READMEs have the same sections and images

- **WHEN** a reader opens `README.md` and `README.zh-TW.md`
- **THEN** both MUST have the sections above in the same order
- **AND** every image they reference MUST exist under `docs/images/`
- **AND** each MUST link to the other near the top

#### Scenario: Screenshots contain no private data

- **WHEN** the maintainer runs the screenshot script
- **THEN** every image MUST be created from the script's example projects and example calendar
- **AND** no file under `docs/images/` MUST show a name from the maintainer's vault or a real calendar address
