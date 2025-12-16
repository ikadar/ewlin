---
description: Generate formal specifications from natural language requirement
---

# Create Specification: $ARGUMENTS

Generate formal specifications from the provided natural language requirement.

---

## Step 0: Ambiguity Discovery

Before analyzing the requirement, identify what information is missing or ambiguous.

### 0.1 Read Context

Read the following documents to understand the domain:
- `docs/documentation-standards/document-structure.md` - ID naming, formats
- `docs/documentation-standards/change-governance.md` - Category Decision Matrix (Sec. 9-10)
- `docs/domain-model/business-rules.md` - Existing business rules
- `docs/domain-model/domain-vocabulary.md` - Domain terms and definitions
- `docs/domain-model/workflow-definitions.md` - Existing workflows (check if behavior already exists)
- `docs/requirements/initial-data-model.md` - Current data model

### 0.2 Analyze the Input

Analyze the natural language input: **$ARGUMENTS**

Identify two types of missing information:

**Classification Rule:** If a question has multiple valid domain interpretations, it MUST be classified as a Decision, NOT a Missing Fact.

**Diagnostic heuristic:**
> "Could two reasonable domain experts give different answers?"
> - If YES → Decision
> - If NO → Missing Fact

**Faktum-hiányok (Facts)** - Information the user *knows*, not *decides*:
- User role (ki használja?) - if unambiguous
- Concrete values: email, specific number, error message text
- Field type, unit - if only one valid interpretation exists

**NOT a fact** (these are Decisions):
- "What does X mean?" - definition questions
- "When does Y count as Z?" - threshold interpretations
- "What operation counts as W?" - semantic boundaries

**Döntés-hiányok (Decisions)** - Choosing between valid alternatives:
- Domain definitions ("What does 'late' mean?")
- Threshold interpretations ("When is something 'critical'?")
- Operation semantics ("What counts as 'rescheduling'?")
- Entity ownership, validation rules, constraints
- Affected operations (create/update/both)

### 0.3 Ambiguity Gate

If there are **decision gaps**, present them and **STOP**:

```markdown
## Ambiguity Discovery

**Input:** {original input}

**Missing facts (kérdések):**
- {fact question 1}?
- {fact question 2}?

**Open decisions (döntések szükségesek):**

1. **{Decision topic}**
   - Option A: {description} ← Recommended if {reason}
   - Option B: {description}

2. **{Decision topic}**
   - Option A: {description}
   - Option B: {description} ← Recommended if {reason}

---
**Please answer the questions and choose from the options above.**
```

**STOP - Wait for user to resolve all ambiguities.**

If no significant ambiguities exist (simple, clear requirement), proceed to Step 1.

---

## Step 1: Analyze & Propose

Only proceed after all ambiguities are resolved.

### 1.1 Determine Category

Determine change category (based on Change Governance Sec. 9-10):
- **Category A (Domain/Spec-First):** Changes user capabilities, system behavior, or user communication → continue
- **Category B (Visual Polish):** Pure visual/aesthetic, no behavior change → suggest DS reference instead, exit
- **Category C (Technical):** Infrastructure, security, refactoring → suggest commit justification instead, exit

**Note:** Security, audit, and reliability changes often affect domain behavior - don't automatically classify as Category C.

### 1.2 Determine Required Specs

If Category A, determine change type and required specs:

| Change Type | Indicators | Required Specs |
|-------------|------------|----------------|
| New backend feature | API, endpoint, service, validation | US + AC + API/IC |
| New frontend feature | UI, component, screen, panel | US + AC + UX |
| Business rule change | constraint, rule, validation, must/cannot | BR + AC |
| User interaction change | click, hover, select, input | AC + UX |
| Data model change | entity, field, relationship | AC + BR |
| Notification/communication | notify, email, alert, message, report | US + AC (+ WF if complex) |

**Important:** Never propose a BR solely for notification or communication behavior. Notifications are reactions to domain events, not domain invariants.

Search existing specs for related items using grep patterns.

### 1.3 BR vs Policy/Workflow Distinction

Before proposing specs, determine if the change involves domain invariants or reactive behavior:

**Business Rule (BR)** = Domain invariant that MUST always hold:
- "A Job MUST have a workshopExitDate"
- "A Task CANNOT start before its predecessor completes"
- Keyword pattern: MUST, CANNOT, ALWAYS, NEVER (state constraints)

**Policy/Workflow (AC or WF)** = Reaction to a domain event:
- "When a job becomes late, notify the scheduler"
- "Send daily summary of delayed jobs"
- Keyword pattern: WHEN...THEN, IF...THEN, ON...DO (event reactions)

**Important:** A policy can be deterministic and mandatory without being an invariant. "The system MUST notify" describes required behavior, not a domain constraint.

**Decision criteria:**

| Question | BR | AC/WF |
|----------|:--:|:-----:|
| Is it always true regardless of context? | ✓ | |
| Is it a reaction to a state change? | | ✓ |
| Does it constrain what states are valid? | ✓ | |
| Does it constrain what users/system can DO? | | ✓ |
| Does it describe notification/communication? | | ✓ |
| Does it define what "X" means? (e.g., "late") | ✓ | |
| Does it define what happens when "X" occurs? | | ✓ |

**Example:** Late job notification
- ✓ BR-SCHED-005 defines what "late" means (invariant)
- ✓ AC-NOTIFY-xxx describes notification behavior (reaction)
- ✗ BR-NOTIFY-xxx would conflate invariant with policy

**Rules:**

1. If classified as Policy/Workflow, do NOT propose a new BR. Use AC and/or WF instead.

2. **Operation constraint rule:** If a rule constrains *user operations* rather than *domain state validity*, prefer AC/WF over BR unless explicitly stated as invariant.
   - "scheduler cannot do X" → AC (operation constraint)
   - "job cannot be in state X while Y" → BR (state invariant)

3. **BR minimization principle:** A BR MUST describe *what is true*, not *what the system does*.
   - ✓ BR: "A job is critically late when now() - workshopExitDate ≥ 5 days"
   - ✗ BR: "The system warns when rescheduling critically late jobs" (this is AC)

### 1.4 Present Proposal

Present the proposal with resolved decisions and **STOP - wait for confirmation**:

```markdown
## Spec Proposal

**Natural language input:**
> {original input}

**Resolved decisions:**
- {decision 1}: {chosen option}
- {decision 2}: {chosen option}

**Classification:**
- Category: {A/B/C} - {name}
- Change type: {detected change type}
- Path: {Backend/Frontend/Both}

**Proposed specifications:**

*Domain specs (create first):*
- [ ] US-xxx - {user need}
- [ ] AC-xxx - {behavior}
- [ ] BR-xxx - {invariant, only if needed}

*Derived specs (after domain approval):*
- [ ] API-xxx / WF-xxx - {technical spec}
- [ ] UX-xxx - {UI spec}

**Related existing specs found:**
- {ID}: {title/summary}
...

---
**Proceed with these specs? (yes / modify selection / cancel)**
```

---

## Step 2: Generate (after approval)

Only proceed after user confirms the proposal.

### 2.1 Assign IDs

For each approved spec type, find the next available ID:
- Search `docs/` for existing IDs in the category
- Assign next sequential number (e.g., if US-GATE-002 exists, use US-GATE-003)

### 2.2 Generate Specifications

Generate each specification following `document-structure.md` standards.

**Important:** Incorporate the resolved decisions into the specs:
- Decisions about constraints → BR
- Decisions about behavior → AC
- Decisions about validation → BR + AC

**User Story (US):**
```markdown
### {Title}
#### US-{CATEGORY}-{NNN}
> **References:** [BR-*](path#anchor) (if applicable)

> As a **{role}**, I want **{goal}**, so that **{benefit}**.

**Acceptance Criteria:**
- {criterion 1}
- {criterion 2}
```

**Acceptance Criteria (AC):**
```markdown
### AC-{CATEGORY}-{NNN}: {Title}
> **References:** [US-*](path#anchor), [BR-*](path#anchor)

**Given** {precondition}
**When** {action}
**Then** {expected result}
```

**Business Rule (BR):**
```markdown
### BR-{CATEGORY}-{NNN}: {Title}

{Rule description}

**Constraints:**
- {constraint 1}
- {constraint 2}
```

**API Interface Draft (API):**
```markdown
### API-{CATEGORY}-{NNN}: {Title}
> **References:** [AC-*](path#anchor)

**Method:** {HTTP method}
**Endpoint:** {path}
**Description:** {what it does}
```

**UX Specification (UX):**
```markdown
### {Title}
#### UX-{CATEGORY}-{NNN}
> **References:** [US-*](path#anchor), [AC-*](path#anchor)

**Component:** {component name}
**Location:** {where in the UI}

**Behavior:**
- {behavior 1}
- {behavior 2}

**States:**
- Default state
- Hover state
- Active state
- Disabled state
```

**Workflow Definition (WF):**
```markdown
### WF-{CATEGORY}-{NNN}: {Title}
> **References:** [AC-*](path#anchor), [BR-*](path#anchor)

**Trigger:** {domain event that starts the workflow}

**Steps:**
1. {step 1}
2. {step 2}
3. {step 3}

**Timing:** {immediate | scheduled | configurable}
**Frequency:** {once per event | daily batch | etc.}
**Idempotency:** {how duplicate triggers are handled, if applicable}
```

### 2.3 Present Generated Specs

Present the generated specifications and **STOP - wait for save confirmation**:

```markdown
## Generated Specification

{all generated specs formatted as above}

---
**Save these specs to docs/? (yes / modify / cancel)**
```

### 2.4 Save to Files (after confirmation)

Only after user confirms:
1. Append each spec to the appropriate file in `docs/`
2. Report which files were modified
3. Suggest running `/spec-check {IDs}` to validate

---

## Important Rules

### STOP Points (3 total)
1. **Ambiguity Gate (Step 0)** - Cannot proceed with open decisions
2. **Proposal Approval (Step 1)** - User confirms spec types
3. **Save Approval (Step 2)** - User confirms generated content

### Decision Handling
- **NEVER** make implicit decisions - all choices must be explicit
- **NEVER** use "best practice" defaults without user confirmation
- **ALWAYS** separate facts (information gathering) from decisions (choosing between alternatives)
- **CAN** recommend options with reasoning, but user must confirm

### Spec Generation
- **NEVER** generate specs without user approval
- **NEVER** save specs without user approval
- **ALWAYS** follow document-structure.md formats exactly
- **ALWAYS** use lowercase anchors in references
- **ALWAYS** check for existing IDs before assigning new ones
- **ALWAYS** record resolved decisions in appropriate spec types (BR for constraints, AC for behavior)

### Communication
- Communication in the user's language (Hungarian for this project)
- Keep ambiguity questions contextual - only ask what's actually unclear for THIS change
- Don't apply a fixed checklist to every change

---

## Examples

### Simple Change (minimal ambiguity)

**Input:** "Szeretném, ha a taskoknál meg lehetne adni a végtermék súlyát."

**Step 0 output:**
```markdown
## Ambiguity Discovery

**Input:** Szeretném, ha a taskoknál meg lehetne adni a végtermék súlyát.

**Missing facts:**
(none - all unknowns require choices between alternatives)

**Open decisions:**
1. **Mértékegység**
   - Option A: Gramm ← Recommended (pontosabb, nagy tartomány)
   - Option B: Kilogramm

2. **Kötelező vagy opcionális?**
   - Option A: Opcionális ← Recommended (nem minden taskhoz releváns)
   - Option B: Kötelező

3. **Bevitel módja**
   - Option A: Külön mező a task szerkesztőben ← Recommended (egyszerűbb)
   - Option B: DSL szintaxis bővítése

---
**Please choose from the options above.**
```

### Complex Change (multiple decisions)

**Input:** "Szeretnék értesítést kapni, ha egy job késésbe kerül."

**Step 0 output:**
```markdown
## Ambiguity Discovery

**Input:** Szeretnék értesítést kapni, ha egy job késésbe kerül.

**Missing facts:**
- Ki kapja az értesítést? (scheduler / production manager / both?)
  *(This is a fact if user knows; becomes decision if unclear)*

**Open decisions:**
1. **"Késés" definíciója**
   *(Note: "Mi számít késésnek?" is a definition question → Decision, not Fact)*
   - Option A: Bármikor scheduledEnd > workshopExitDate ← Recommended (existing BR-JOB-005b)
   - Option B: Csak ha már elkezdődött és késik

2. **Értesítés típusa**
   - Option A: In-app notification
   - Option B: Email értesítés
   - Option C: Mindkettő

3. **Értesítés időzítése**
   - Option A: Azonnal, amikor a job késésbe kerül ← Recommended
   - Option B: Napi összesítő
   - Option C: Konfigurálható

4. **Értesítés tartalma**
   - Option A: Csak job reference + késés mértéke
   - Option B: Részletes info (task lista, okok)

---
**Please answer the fact question and choose from the decision options above.**
```

**Step 1 output (after user resolves ambiguities):**
```markdown
## Spec Proposal

**Natural language input:**
> Szeretnék értesítést kapni, ha egy job késésbe kerül.

**Resolved decisions:**
- Címzett: scheduler
- Értesítés típusa: Email
- Időzítés: Azonnal
- Tartalom: Job reference + késés mértéke

**Classification:**
- Category: A - Domain/Spec-First
- Change type: Notification/communication
- Path: Backend

**Proposed specifications:**

*Domain specs (create first):*
- [ ] US-NOTIFY-001 - User need for late job awareness
- [ ] AC-NOTIFY-001 - Notification trigger and content behavior

*Derived specs (after domain approval):*
- [ ] WF-NOTIFY-001 - Email workflow (timing, retry, templates)

**Related existing specs found:**
- BR-SCHED-005: Deadline enforcement (defines what "late" means)
- BR-JOB-005b: Job Delayed status trigger (defines when job becomes Delayed)

**Note:** No new BR needed. The definition of "late job" is already covered by
BR-SCHED-005 and BR-JOB-005b. The notification is a *reaction* to this state,
not a domain invariant. This example demonstrates why notification behavior
should not create new BRs.

---
**Proceed with these specs? (yes / modify selection / cancel)**
```
