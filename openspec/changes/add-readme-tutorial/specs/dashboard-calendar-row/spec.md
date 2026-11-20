## MODIFIED Requirements

### Requirement: Network use is limited and disclosed

The plugin SHALL make network requests only to the calendar addresses the user stored, only with `GET`, only at the moments listed in "When calendars are fetched", and SHALL NOT send any vault content, setting, or other data. Both `README.md` (English) and `README.zh-TW.md` (Traditional Chinese) SHALL state that the plugin uses the network only when calendars are set, which addresses it reads, that it never writes to a calendar, that fetched events stay in memory, and where the addresses are kept.

The plugin bundles ical.js, which is licensed under MPL-2.0. The comment at the top of `main.js` SHALL name ical.js, its license, and the address of its source code, and both READMEs SHALL have a section on bundled third-party code with the same information.

#### Scenario: Bundle notice

- **WHEN** a release `main.js` is built
- **THEN** its opening comment MUST contain `ical.js`, `MPL-2.0`, and `https://github.com/kewisch/ical.js`

#### Scenario: Both READMEs disclose network use

- **WHEN** a reader opens `README.md` or `README.zh-TW.md`
- **THEN** each MUST have a network-use section and a third-party-code section with the information above
