---
tags:
  - specification
  - requirements
---

# Task DSL Specification – Flux Print Shop Scheduling System

This document defines the **Domain-Specific Language (DSL)** used to define tasks (actions) within jobs in the Flux print shop scheduling system.

The DSL is designed to be:
- **Human-readable** and fast to type
- **Parseable** into structured backend data
- **Displayed** in a textarea with autocomplete and syntax highlighting

---

## 1. Overview

Tasks are defined using a compact text syntax. Each line represents one task in the job's action sequence. Tasks are executed in order (single straight sequence).

**Two task types exist:**
1. **Internal tasks** – performed on a station within the workshop
2. **Outsourced tasks** – performed by an external provider

---

## 2. Syntax

### 2.1 Internal Task Syntax

```
[Station] <Setup>+<Run> "comment"
[Station] <Run> "comment"
"comment" [Station] <Setup>+<Run>
[Station] "comment" <Run>
```

**Components:**

| Component | Required | Format | Description |
|-----------|----------|--------|-------------|
| `[Station]` | Yes | Brackets with station name | Station identifier. Use underscores for spaces (e.g., `[Komori_G37_Advance]`) |
| `<Setup>+<Run>` | Yes (one format) | Integer + Integer | Setup time + Run time in minutes |
| `<Run>` | Yes (one format) | Integer | Run time only (setup = 0) |
| `"comment"` | No | Quoted string | Free-form comment (can appear anywhere in the line) |

**Examples:**

```
[Komori] 20+40
→ Station: Komori, Setup: 20min, Run: 40min, Comment: none

[Komori] 20+40 "vernis"
→ Station: Komori, Setup: 20min, Run: 40min, Comment: "vernis"

"vernis" [Komori] 20+40
→ Station: Komori, Setup: 20min, Run: 40min, Comment: "vernis"

[Komori] "vernis" 20+40
→ Station: Komori, Setup: 20min, Run: 40min, Comment: "vernis"

[Massicot] 15
→ Station: Massicot, Setup: 0min, Run: 15min, Comment: none

[Conditionnement] "au mieux" 15
→ Station: Conditionnement, Setup: 0min, Run: 15min, Comment: "au mieux"

[Komori_G37_Advance] 20+40 "special run"
→ Station: Komori G37 Advance, Setup: 20min, Run: 40min, Comment: "special run"
```

### 2.2 Outsourced Task Syntax

```
ST [Provider] <ActionType> <Duration> "comment"
```

**Components:**

| Component | Required | Format | Description |
|-----------|----------|--------|-------------|
| `ST` | Yes | Literal | Marker indicating outsourced task |
| `[Provider]` | Yes | Brackets with provider name | External provider identifier. Use underscores for spaces |
| `<ActionType>` | Yes | Word | Type of action being outsourced |
| `<Duration>` | Yes | Integer + `JO` | Duration in open (business) days |
| `"comment"` | No | Quoted string | Free-form comment (can appear anywhere after ST) |

**Examples:**

```
ST [Clément] Pelliculage 2JO
→ Outsourced: true, Provider: Clément, ActionType: Pelliculage, Duration: 2 open days

ST [Clément] Pelliculage "fragile" 2JO
→ Outsourced: true, Provider: Clément, ActionType: Pelliculage, Duration: 2 open days, Comment: "fragile"

ST [Clément] "fragile" Pelliculage 2JO
→ Outsourced: true, Provider: Clément, ActionType: Pelliculage, Duration: 2 open days, Comment: "fragile"

ST [ABC_Finishing] Dorure 3JO "gold leaf"
→ Outsourced: true, Provider: ABC Finishing, ActionType: Dorure, Duration: 3 open days, Comment: "gold leaf"
```

---

## 3. Grammar (Formal Definition)

```ebnf
task_line       = internal_task | outsourced_task ;

internal_task   = { comment } station { comment } duration { comment } ;

outsourced_task = "ST" { comment } provider { comment } action_type { comment } open_days { comment } ;

station         = "[" station_name "]" ;
station_name    = identifier ;

provider        = "[" provider_name "]" ;
provider_name   = identifier ;

duration        = setup_run | run_only ;
setup_run       = integer "+" integer ;
run_only        = integer ;

open_days       = integer "JO" ;

action_type     = identifier ;

comment         = '"' string '"' ;

identifier      = letter { letter | digit | "_" } ;
integer         = digit { digit } ;
string          = { any_char_except_quote } ;

letter          = "A".."Z" | "a".."z" | unicode_letter ;
digit           = "0".."9" ;
```

---

## 4. Structured Data Output

The DSL parser produces structured data for backend storage.

### 4.1 Internal Task Structure

```typescript
interface InternalTask {
  type: 'internal';
  stationId: string;           // Resolved station ID (underscores → spaces)
  stationName: string;         // Display name
  setupMinutes: number;        // 0 if not specified
  runMinutes: number;
  totalMinutes: number;        // setupMinutes + runMinutes
  comment: string | null;
  rawInput: string;            // Original DSL line for reference
}
```

### 4.2 Outsourced Task Structure

```typescript
interface OutsourcedTask {
  type: 'outsourced';
  providerId: string;          // Resolved provider ID
  providerName: string;        // Display name
  actionType: string;
  durationOpenDays: number;
  comment: string | null;
  rawInput: string;            // Original DSL line for reference
}

type Task = InternalTask | OutsourcedTask;
```

### 4.3 Example Parsing

**Input:**
```
[Komori] 20+40 "vernis"
[Massicot] 15
ST [Clément] Pelliculage 2JO
[Conditionnement] "au mieux" 30
```

**Output:**
```json
[
  {
    "type": "internal",
    "stationId": "komori",
    "stationName": "Komori",
    "setupMinutes": 20,
    "runMinutes": 40,
    "totalMinutes": 60,
    "comment": "vernis",
    "rawInput": "[Komori] 20+40 \"vernis\""
  },
  {
    "type": "internal",
    "stationId": "massicot",
    "stationName": "Massicot",
    "setupMinutes": 0,
    "runMinutes": 15,
    "totalMinutes": 15,
    "comment": null,
    "rawInput": "[Massicot] 15"
  },
  {
    "type": "outsourced",
    "providerId": "clement",
    "providerName": "Clément",
    "actionType": "Pelliculage",
    "durationOpenDays": 2,
    "comment": null,
    "rawInput": "ST [Clément] Pelliculage 2JO"
  },
  {
    "type": "internal",
    "stationId": "conditionnement",
    "stationName": "Conditionnement",
    "setupMinutes": 0,
    "runMinutes": 30,
    "totalMinutes": 30,
    "comment": "au mieux",
    "rawInput": "[Conditionnement] \"au mieux\" 30"
  }
]
```

---

## 5. Station Name Resolution

Station names use underscores to represent spaces:

| DSL Input | Resolved Name | ID (lowercase, underscores) |
|-----------|---------------|----------------------------|
| `[Komori]` | Komori | `komori` |
| `[Komori_G37]` | Komori G37 | `komori_g37` |
| `[Komori_G37_Advance]` | Komori G37 Advance | `komori_g37_advance` |
| `[Heidelberg_XL_106]` | Heidelberg XL 106 | `heidelberg_xl_106` |

**Resolution rules:**
1. Underscores in input → spaces in display name
2. ID is lowercase with underscores preserved
3. Station must exist in the system (validation error if not found)

---

## 6. Validation Rules

### 6.1 Syntax Validation

| Error | Example | Message |
|-------|---------|---------|
| Missing station | `20+40` | "Station required: use [StationName]" |
| Missing duration | `[Komori]` | "Duration required: use N or N+N format" |
| Invalid duration | `[Komori] abc` | "Invalid duration format" |
| Unclosed bracket | `[Komori 20+40` | "Unclosed bracket in station name" |
| Unclosed quote | `[Komori] 20+40 "vernis` | "Unclosed quote in comment" |
| Invalid outsource | `ST Pelliculage 2JO` | "Provider required: use ST [Provider] ActionType NJO" |
| Missing JO suffix | `ST [Clément] Pelliculage 2` | "Open days must end with JO (e.g., 2JO)" |

### 6.2 Semantic Validation

| Error | Example | Message |
|-------|---------|---------|
| Unknown station | `[UnknownMachine] 20+40` | "Station 'UnknownMachine' not found" |
| Unknown provider | `ST [UnknownCo] Pelliculage 2JO` | "Provider 'UnknownCo' not found" |
| Negative duration | `[Komori] -5+10` | "Duration must be positive" |
| Zero duration | `[Komori] 0` | "Duration must be greater than zero" |

---

## 7. UI Behavior

### 7.1 Textarea Input

- **Multiline textarea** for entering task definitions
- One task per line
- Empty lines are ignored
- Lines starting with `#` are treated as comments (ignored by parser)

### 7.2 Autocomplete

Autocomplete triggers on:

| Trigger | Suggestions |
|---------|-------------|
| `[` typed | List of available station names |
| `ST [` typed | List of available provider names |
| After provider name | List of common action types for that provider |

### 7.3 Syntax Highlighting

| Element | Color/Style |
|---------|-------------|
| Station brackets `[...]` | Blue, bold |
| Provider brackets (after ST) | Purple, bold |
| `ST` keyword | Purple, bold |
| Duration numbers | Green |
| `+` separator | Gray |
| `JO` suffix | Green |
| Comments `"..."` | Orange, italic |
| Errors | Red underline |

### 7.4 Real-time Validation

- Syntax errors highlighted as user types
- Semantic validation on blur or explicit trigger
- Error messages shown inline or in summary panel

---

## 8. Task Sequencing

Tasks defined in the DSL form a **single straight sequence**:
- Task 1 must complete before Task 2 can start
- Task 2 must complete before Task 3 can start
- And so on...

**Brochures (multi-part jobs) are inseparable** – if the user wants to separate elements, they must create separate jobs (one row per element).

The order of tasks can be rearranged in the UI by:
1. Reordering lines in the textarea
2. Drag-and-drop in the action list panel

---

## 9. Business Day Calculation

For outsourced tasks, duration is specified in **open days (JO = jours ouvrés)**:

**MVP:**
- Open days = Monday through Friday
- Excludes weekends

**Future Enhancement:**
- French public holidays excluded
- Configurable per-provider calendars

**Example:**
- Task outsourced on Friday with 2JO duration
- Returns on Tuesday (skips Saturday, Sunday)

---

## 10. Backward Compatibility

If the DSL syntax needs to evolve:
1. New syntax versions are introduced with explicit versioning
2. Old syntax remains parseable
3. Migration tools provided to update stored task definitions
4. Raw input is always preserved for reference

---

## 11. Error Recovery

The parser attempts graceful error recovery:

| Situation | Behavior |
|-----------|----------|
| Partial line | Parse what's valid, flag errors |
| One bad line in multi-line | Parse valid lines, skip invalid with error |
| Missing station | Suggest closest match |
| Typo in station name | Suggest correction if Levenshtein distance ≤ 2 |

---

## Notes

- This DSL is designed for speed of entry by experienced users
- The textarea with autocomplete provides guidance for new users
- Backend always stores structured data, DSL is for input only
- The `rawInput` field preserves exact user input for debugging/audit
