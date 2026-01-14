# BMAD Integration Plan for Flux Scheduler

This document describes the integration of BMAD-style (Breakthrough Method for Agile AI-Driven Development) agents and skills into the Flux Scheduler project workflow.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEW BMAD-STYLE SKILLS                        │
│  Conversation: French | Produced documentation: English         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🎭 AGENTS          🧠 CREATIVITY        👥 COLLABORATION       │
│  /agent-architect   /brainstorm          /party                 │
│  /agent-ux          /design-thinking     /code-review           │
│  /agent-analyst                                                 │
│  /agent-dev         📋 PLANNING                                 │
│  /agent-qa          /plan-feature                               │
│  /agent-pm                                                      │
│                                                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                 EXISTING SKILLS (unchanged)                     │
│  /implement-release                                             │
│  /implement-ui-release                                          │
│  /implement-ui-release-from-requirement                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Agents (Conversational Personas)

### Common Structure

Each agent will have:
- A **distinct personality** (communication style, expertise)
- **Knowledge of the Flux project** (reads relevant docs)
- **Conversation in French**, documentation output in English

### Agent List

| File | Skill | Persona | Expertise | Auto-read docs |
|------|-------|---------|-----------|----------------|
| `agent-architect.md` | `/agent-architect` | **Winston** - Senior Architect, methodical, long-term oriented | Architecture, ADR, patterns, performance, scalability | `docs/architecture/`, `docs/domain-model/` |
| `agent-ux.md` | `/agent-ux` | **Sally** - UX Expert, empathetic, user-centered | UI/UX, ergonomics, accessibility, design system | `docs/ux-ui/`, mockups |
| `agent-analyst.md` | `/agent-analyst` | **Mary** - Business Analyst, curious, value-oriented | Requirements, business rules, use cases, edge cases | `docs/domain-model/`, `docs/ux-ui/tmp/backlog.md` |
| `agent-dev.md` | `/agent-dev` | **Amelia** - Senior Developer, pragmatic, quality-first | Implementation, best practices, refactoring, code review | `apps/web/src/`, project conventions |
| `agent-qa.md` | `/agent-qa` | **Murat** - Test Architect, rigorous, edge-case oriented | Tests, quality, coverage, test scenarios | `apps/web/playwright/`, fixtures |
| `agent-pm.md` | `/agent-pm` | **John** - Product Manager, strategic, roadmap-oriented | Prioritization, breakdown, MVP, trade-offs | `docs/roadmap/`, backlog |

### Output

**No mandatory output** - pure conversations. The agent may suggest creating a doc but only does so if requested.

---

## 2. Creativity Skills

### `/brainstorm`

| Aspect | Detail |
|--------|--------|
| **File** | `.claude/commands/brainstorm.md` |
| **Persona** | Carson - Energetic facilitator |
| **Included techniques** | SCAMPER, Six Thinking Hats, What-if, Yes-And, Divergent/Convergent, Mind mapping, Crazy 8s |
| **Flow** | 1. Define topic 2. Choose technique 3. Guided session 4. Synthesis |
| **Optional output** | `docs/brainstorm/YYYY-MM-DD-{topic}.md` (if requested) |
| **Language** | Conversation FR, output EN |

### `/design-thinking`

| Aspect | Detail |
|--------|--------|
| **File** | `.claude/commands/design-thinking.md` |
| **Persona** | Maya - Design Thinking Maestro |
| **Phases** | Empathize → Define → Ideate → Prototype → Test |
| **Flow** | Guided phase by phase, can stop at any phase |
| **Optional output** | `docs/design-thinking/YYYY-MM-DD-{topic}.md` |
| **Language** | Conversation FR, output EN |

---

## 3. Collaboration Skills

### `/party`

| Aspect | Detail |
|--------|--------|
| **File** | `.claude/commands/party.md` |
| **Principle** | Activates 2-4 relevant agents who discuss together |
| **Flow** | 1. You ask a question/problem 2. I select relevant agents 3. Each agent gives their perspective 4. Synthesis of consensus/divergences |
| **Example** | Question about feature architecture → Winston (arch) + Sally (UX) + Amelia (dev) discuss |
| **Output** | None - pure conversation |
| **Language** | Conversation FR |

### `/code-review`

| Aspect | Detail |
|--------|--------|
| **File** | `.claude/commands/code-review.md` |
| **Active personas** | Amelia (dev) + Murat (QA) |
| **Input** | Files or directory to review (argument or interactive selection) |
| **Flow** | 1. Code analysis 2. List of issues (severity, location, suggestion) 3. Ask: "Do you want me to fix these?" 4. If yes → corrections |
| **Categories** | Bugs, Performance, Security, Readability, Missing tests, Conventions |
| **Output** | Direct corrections in code (if requested) |
| **Language** | Conversation FR, code comments EN |

---

## 4. Planning Skill

### `/plan-feature`

| Aspect | Detail |
|--------|--------|
| **File** | `.claude/commands/plan-feature.md` |
| **Active personas** | Mary (analyst) + Winston (arch) + John (PM) |
| **Input** | REQ-XX or free description of a feature |
| **Flow** | 1. Discussion on scope 2. Technical analysis 3. Proposal to break down into releases 4. Ask: "Do you want me to create the release docs?" |
| **Output if accepted** | `docs/releases/v{VERSION}-{name}.md` (one or more) |
| **Update** | `docs/roadmap/release-roadmap.md` (add new releases) |
| **Language** | Conversation FR, **docs EN** |

---

## 5. File Structure

### New Files to Create

```
.claude/commands/
├── agent-architect.md      # Winston
├── agent-ux.md             # Sally
├── agent-analyst.md        # Mary
├── agent-dev.md            # Amelia
├── agent-qa.md             # Murat
├── agent-pm.md             # John
├── brainstorm.md           # Carson + techniques
├── design-thinking.md      # Maya + process
├── party.md                # Multi-agent orchestration
├── code-review.md          # Amelia + Murat
├── plan-feature.md         # Mary + Winston + John
│
├── implement-release.md           # (existing - unchanged)
├── implement-ui-release.md        # (existing - unchanged)
└── implement-ui-release-from-requirement.md  # (existing - unchanged)
```

### New Output Directories (Optional)

```
docs/
├── brainstorm/             # Output from /brainstorm (if requested)
│   └── YYYY-MM-DD-{topic}.md
├── design-thinking/        # Output from /design-thinking (if requested)
│   └── YYYY-MM-DD-{topic}.md
├── releases/               # (existing) - /plan-feature writes here
├── roadmap/                # (existing) - /plan-feature updates this
└── ...
```

---

## 6. Language Rules

| Context | Language |
|---------|----------|
| Conversation with agents | **French** |
| Agent persona/style | **French** |
| Produced documentation (release docs, brainstorm, etc.) | **English** |
| Code and comments | **English** |
| Commit messages | **English** |
| File names | **English** |

---

## 7. Compatibility Matrix

| New skill | Can precede | Does not replace |
|-----------|-------------|------------------|
| `/agent-*` | Any action | - |
| `/brainstorm` | `/plan-feature`, `/implement-*` | - |
| `/design-thinking` | `/plan-feature`, `/implement-*` | - |
| `/party` | Any action | - |
| `/code-review` | Commit, PR | `/implement-*` (different scope) |
| `/plan-feature` | `/implement-ui-release` | `/implement-ui-release-from-requirement` (complementary) |

---

## 8. Typical Workflows

### Example 1: Complex New Feature

```
1. /brainstorm "multi-selection drag-drop"
   → Creative session, exploring possibilities

2. /party "What approach do you recommend?"
   → Winston, Sally, Amelia discuss

3. /plan-feature "Multi-select drag-drop based on our discussion"
   → Breakdown into v0.3.54, v0.3.55, v0.3.56
   → Release docs created (EN)

4. /implement-ui-release v0.3.54-multi-select-tiles
   → Implementation of first release
```

### Example 2: Existing Code Review

```
1. /code-review apps/web/src/components/Tile/
   → Amelia + Murat analyze
   → List of 5 issues found

2. "Yes, fix the performance issues"
   → Corrections applied

3. (optional) /implement-ui-release if it warrants a release
```

### Example 3: Architecture Discussion

```
1. /agent-architect "How should we handle multi-selection state?"
   → Winston analyzes, proposes patterns

2. /agent-ux "And from a UX perspective, how to indicate selection?"
   → Sally proposes visual solutions

3. (no formal output, just reflection)
```

---

## 9. BMAD Source vs Adaptation

| Element | Source | Adaptation |
|---------|--------|------------|
| Personas (Winston, Sally, etc.) | BMAD | Translated to FR + Flux context added |
| Brainstorming techniques | BMAD | None |
| Design Thinking process | BMAD | None |
| Party mode | BMAD | Limited to 2-4 agents (not all) |
| Code review | BMAD | Adapted to Flux conventions |
| Plan-feature | **New** | Created to map to Flux workflow |
| Output directories | **New** | Flux structure |
| FR/EN language split | **New** | Specific to project requirements |

---

## 10. Implementation Checklist

### Phase 1: Agents
- [ ] Create `agent-architect.md` (Winston)
- [ ] Create `agent-ux.md` (Sally)
- [ ] Create `agent-analyst.md` (Mary)
- [ ] Create `agent-dev.md` (Amelia)
- [ ] Create `agent-qa.md` (Murat)
- [ ] Create `agent-pm.md` (John)

### Phase 2: Creativity Skills
- [ ] Create `brainstorm.md` (Carson)
- [ ] Create `design-thinking.md` (Maya)

### Phase 3: Collaboration Skills
- [ ] Create `party.md`
- [ ] Create `code-review.md`

### Phase 4: Planning Skill
- [ ] Create `plan-feature.md`

### Phase 5: Output Directories
- [ ] Create `docs/brainstorm/.gitkeep`
- [ ] Create `docs/design-thinking/.gitkeep`

---

## References

- [BMAD-METHOD GitHub](https://github.com/bmad-code-org/BMAD-METHOD)
- [BMAD Creative Intelligence Suite](https://docs.bmad-method.org/explanation/creative-intelligence/)
- [Existing Flux Release Workflow](./git-release-strategy.md)
