## MODIFIED Requirements

### Requirement: Override applied at highest classification priority by exact name

The scanner's `classify` step SHALL apply the override store at the HIGHEST priority, matching the project's full name EXACTLY. The classification order SHALL be: (1) exact-name override hit → its category; otherwise (2) the first classification rule from the settings, in list order, whose text is non-empty and contained in the project's full name → that rule's category (rules with empty text are skipped); otherwise (3) `other`. An override SHALL affect only the exact project whose full name matches its key, and MUST NOT affect other projects that merely share a name fragment.

#### Scenario: Exact-name override beats keyword classification

- **GIVEN** an override entry `{ "P-2026 範例：家庭生活專案 @小明 @小美": "life" }`
- **WHEN** the scanner classifies that project
- **THEN** its category MUST be `life`, regardless of keyword matches

#### Scenario: Override does not leak to fragment-sharing projects

- **GIVEN** an override only for the exact project `P-2026 範例：家庭生活專案 @小明 @小美`
- **AND** another project whose name also contains `家庭生活專案` but is NOT overridden
- **WHEN** the scanner classifies both
- **THEN** only the exact-named project MUST take the override category
- **AND** the other `家庭生活專案` project MUST be classified by the normal rules

#### Scenario: The first matching rule wins

- **GIVEN** no override for the project `P-2026 範例內訓課程`
- **WHEN** the scanner classifies it with the rules below
- **THEN** its category MUST match the expected value

##### Example: rule order

| Classification rules, in order | Expected category |
| ------------------------------ | ----------------- |
| `內訓` → `corporate`, `課程` → `online_course` | `corporate` |
| `課程` → `online_course`, `內訓` → `corporate` | `online_course` |
| (empty text) → `life`, `內訓` → `corporate` | `corporate` |
| `出版` → `publishing` | `other` |
| (none) | `other` |

---
### Requirement: Manual category override persisted

The dashboard SHALL let the user manually assign a project's category from the UI, and SHALL persist that assignment keyed by the project's full name (the `stripStatus`-cleaned project name) mapped to a category key that exists in `CATEGORIES`. When no override is stored for a project, the system SHALL treat it as unset and continue scanning normally.

#### Scenario: Override survives re-scan and restart

- **GIVEN** a project `P-2026 範例專案 A` that no classification rule matches, so it is placed in `other`
- **WHEN** the user assigns it to the `life` category in the UI
- **THEN** the stored overrides MUST contain an entry mapping that project's full name to `"life"`
- **AND** after the next re-scan (or restart) the project MUST still be categorized as `life`

#### Scenario: Missing override store is not an error

- **GIVEN** no overrides are stored
- **WHEN** the scanner runs
- **THEN** classification MUST proceed using the classification rules from the settings with no error
