# Deterministic Operator Scheduling Algorithm — Analysis & Discussion

> **Date:** 2026-03-28
> **Source:** `docs/external/algo-déterministe-opérateurs.pdf`
> **Context:** Julien shared a constraint-based scheduling vision and a deterministic algorithm for operator-aware scheduling. This document captures the full analysis and discussion.

---

## Table of Contents

1. [Context: Julien's Constraint-Based Vision](#1-context-juliens-constraint-based-vision)
2. [Algorithm Overview](#2-algorithm-overview)
3. [Initial Analysis](#3-initial-analysis)
4. [Full Discussion (Verbatim)](#4-full-discussion-verbatim)
   - 4.1 — Concern #2: Backward Pass Mitigates Sub-Loop Monopolization
   - 4.2 — Concern #6: LAST Used in Forward Pass Scoring
   - 4.3 — Performance: Language Change Impact
   - 4.4 — Multi-Rate Ticks Per Machine
   - 4.5 — Concern #4 & #5: Attention Model Resolves Multi-Operator Machines
   - 4.6 — FBI (Feedback-Based Improvement) Interaction
   - 4.7 — Rolling Window Approach
   - 4.8 — Task Splitting / Interleaving (sub-loop contention analysis)
   - 4.9 — Sub-Loop Anti-Fragmentation vs. Preemption
   - 4.10 — Pre-Split Long Tasks **(AGREED APPROACH)**
5. [Open Topics](#5-open-topics)

---

## 1. Context: Julien's Constraint-Based Vision

Before the algorithm review, Julien shared this insight (2026-03-27 23:26):

> You can't have an operator-based schedule where you move tiles, because when you move a tile it changes operator assignments, which changes the duration of the tile you moved but also potentially the duration of other tiles that will see their operators change and therefore their durations change. The thing will spend its time jiggling around at the slightest movement.
>
> **Solution: you don't move tiles, you describe constraints and the schedule recalculates automatically.**
>
> - The press is in maintenance Thursday 15h-19h → new constraint: "G37 is unavailable 15h-19h Thursday"
> - Bernard has a doctor's appointment tomorrow, he needs to leave at 12h instead of 13h → new constraint: "Bernard absent 12h-13h tomorrow"
> - The paper is running poorly today on the AFVAC brochure, running at 8000 instead of 12000 → new constraint: "task G37 on AFVAC interior is expected to take 180 minutes instead of 120 minutes"
> - The client is coming for the Opéra de Metz press proof Monday at 17h → new constraint: "task G40 on job 4402 Opéra de Metz will start Monday at 16h45"
>
> You no longer use the scheduling tool to order things yourself — you enter your constraints and the system orders based on them.

And a follow-up (23:27):

> I'm sure this sounds unusual, or you might think it requires an incredibly performant placement algorithm, but I believe not having adopted this approach is the explanation for the absence of any solution that handles operator-based scheduling.

### Assessment of the Vision

This insight correctly identifies the **"jelly schedule" problem** — well-known in operations research. When task durations depend on who performs them (variable productivity), manual tile manipulation creates cascading recalculations. The standard OR solution is exactly what Julien describes: constraint programming where users declare constraints and a solver optimizes.

**Relationship to the current MVP documents** (`operator-data-model-mvp.md`, `operator-implementation-plan.md`):
- The MVP is **not affected** — it uses uniform productivity (1.0), so no cascading
- ADR-014 point 3 explicitly identifies the jelly schedule problem and defers it
- The tension is about **post-MVP direction**: the V2 extension path (§13) proposes adding productivity coefficients to the existing model, while Julien's vision suggests the interaction model itself should change
- The MVP's auto-assign (OP-05), autoplace, and solver infrastructure are compatible foundations for the constraint-based approach

---

## 2. Algorithm Overview

The PDF describes a **two-pass deterministic scheduling algorithm** with integrated operator assignment.

### Pass 1: LAST/LAET — Backward Scheduling

Classic backward scheduling from deadlines:

1. **Sort jobs by deadline DESC**
2. For each job, **reverse** the part/action dependency chain (last action first)
3. For each action (in reverse order):
   - If the action has a successor: T = LAST of the successor
   - If no successor: T = Job Deadline
   - Walk backward through time (T = T-1) until a slot with available machine + operator is found
   - Assign action, set LAST = T
   - Result: each action has a **LAST** (Latest Allowable Start Time) — the latest it can begin without violating its deadline, accounting for all downstream dependencies

### Pass 2: Forward Chronological Scheduling ("Algo chrono troisième jet")

Forward simulation starting at T=0, advancing in time units (Ut):

```
T = 0
Repeat until sum(ART) = 0
  REPEAT UNTIL EA (Eligible Action) = null
    Score eligible actions:
      score = calage bonus (setup alignment with last action on machine)
      If LAST = T → score = 9999 (deadline emergency)
    Sort by score DESC
    FOREACH EA (in score order):
      Check resource availability (machine + operator)
      If available → assign, enter sub-loop to schedule to completion
      Sub-loop handles:
        - Operator continuity (prefer same operator)
        - Operator fallback (try any available operator)
        - Setup peremption (re-setup if interrupted too long)
        - LAST safety check (rollback if another action's LAST exceeded)
        - Degraded vs nominal mode (based on operator attention)
  End-of-timestep: recalculate operator attention
    If attention freed up → switch degraded actions to nominal mode
  T = T+1
```

### Key Domain Concepts

| Concept | Description |
|---------|-------------|
| **Operator Attention** | Each operator has attention = 1.0 to distribute. Each machine declares attention required for full operation (e.g., 1.0) and masked time (e.g., 0.3). Machines can require attention > 1.0, meaning multiple operators needed. Productivity = min(attention_received / attention_required, 1.0). |
| **Setup Peremption** | If an action is interrupted beyond a machine-specific threshold, the makeready must be redone. Setup time is added back to ART. Models real print shop behavior (ink dries, temperature shifts, paper humidity changes). |
| **Masked Time** | The **run phase** of an action (after setup), during which the machine only needs monitoring. Machine attention drops from full to masked level, freeing operator attention. Setup is never maskable — only the run phase is. Freed attention is automatically allocated to other eligible work through normal scoring. |
| **Degraded vs Nominal Mode** | Nominal = machine gets full required attention → full productivity. Degraded = machine gets partial attention → proportional productivity loss. End-of-timestep recalculation detects when attention frees up and switches degraded actions to nominal. |
| **Calage Bonus** | Actions that can reuse the current machine setup score higher — minimizes changeover time. Continuation of current action is strongly preferred. |

---

## 3. Initial Analysis

### Strengths Identified

**1. Time-slot granularity instead of tile blocks.**
Unlike the current Flux model (which places entire tasks as atomic blocks), this algorithm assigns each time slot individually. This naturally enables tasks that get interrupted and resumed, operator switches mid-task, and variable duration through the attention/productivity model.

**2. Integrated machine + operator assignment.**
Unlike the current MVP plan (place on machines first, assign operators second), this algorithm assigns machine, operator, AND time slot simultaneously. No cascading recalculation because both resources are committed together.

**3. Operator attention model.**
Each operator has "attention" per time slot in [0, 1]. An experienced operator can supervise multiple machines with split attention. When one machine finishes, they give full attention to the other. The model is formalized through machine-declared requirements (see Discussion section for details).

**4. Setup peremption.**
If a task is paused too long, the makeready expires. The algorithm tracks elapsed action time vs setup time, maintains a peremption counter, and adds re-setup time to ART when the counter reaches zero. This models real print shop behavior that no generic scheduling software captures.

**5. Masked time.**
During an action's run phase (after setup), the machine drops to reduced attention, freeing the operator for other work. This is not a special mechanism — it's an emergent property of the attention model. Setup is never maskable; only the run phase is. The algorithm fills freed attention automatically through normal scoring.

**6. Two-pass design.**
The backward pass computes deadline pressure for every action (LAST values). The forward pass uses these for priority scoring. The interaction between the two passes is well-designed — the backward pass provides the "urgency signal" that the forward pass respects.

### Initial Concerns Raised

Six concerns were initially raised. Through discussion, four were resolved:

| # | Concern | Status | Resolution |
|---|---------|--------|------------|
| 1 | Greedy with no backtracking | **Accepted tradeoff** | Mitigated by FBI + backward pass. Pragmatic choice — CP solver would be ideal but FBI gives 80% of the benefit at 1% of the implementation complexity. |
| 2 | Sub-loop monopolizes machine, blocks other actions | **Resolved (with nuance)** | The backward pass computes LAST for every action. Inside the sub-loop, the LAST check triggers rollback (dégradé KO) when another action's deadline is exceeded — but only in the "no resource" branch (see §4.8). Pre-splitting long tasks (§4.10) limits monopolization to max chunk size (e.g., 7h), making the residual gap tolerable. |
| 3 | Computational cost O(T × A × O) | **Resolved** | Mitigated by: language change (PHP→Rust: 30-100x), multi-rate ticks per machine (2-3x), rolling window with tiered resolution (7x near-term). Combined: interactive speed achievable. |
| 4 | Attention model under-specified | **Resolved** | Machines declare required attention levels for full operation and masked time. Operators distribute attention = 1.0 across machines. Machines with attention > 1.0 require multiple operators. Productivity = min(received/required, 1.0). |
| 5 | Multi-operator machines, machine capacity | **Resolved** | Subsumed by the attention model. Attention > 1.0 = multi-operator machine. Attention = 2.0 = needs 2 full operators. Falls out naturally from the unified attention model. |
| 6 | LAST/LAET not used in forward pass scoring | **Resolved** | LAST IS used: `Si LAST = T, score = 9999` gives maximum priority to deadline-critical actions. Two-tier priority: calage bonus for efficiency, LAST override for correctness. |

---

## 4. Full Discussion (Verbatim)

### 4.1 — Concern #2: Backward Pass Mitigates Sub-Loop Monopolization

**Julien:**
> Concern #2 is mitigated by the backward pass which says when a task becomes top priority no?

**Claude:**
You're right, I was wrong on that one. Re-reading more carefully, the LAST values from the backward pass serve as a safety net at two levels:

**1. In the scoring** — `Si LAST = T, score = 9999`: when the forward pass reaches T = an action's latest allowable start time, that action gets score 9999, overriding any setup-alignment bonus.

**2. Inside the sub-loop itself** — there's an explicit check I glossed over:

> "Est-ce que le LAST d'une autre action sur cette même machine est dépassé?"
> → OUI: "Je retire toutes les assignations faites / Je set le flag dégradé KO / Break"

So even while scheduling an action to completion, if advancing T would cause another action on the same machine to miss its LAST deadline, the algorithm rolls back the current action entirely and breaks out. The current action doesn't blindly hog the machine.

The backward pass is essentially computing a "drop-dead date" for every action, and the forward pass respects it both at selection time (scoring) and mid-execution (the LAST-exceeded rollback). My concern #2 was wrong — the interaction between the two passes is actually well designed.

The only residual edge case: the LAST check inside the sub-loop is scoped to "another action on this same machine." Actions on different machines whose LAST is being exceeded aren't checked — but those aren't competing for the same resource, so they'd be picked up in the next iteration of the outer loop.

---

### 4.2 — Concern #6: LAST Used in Forward Pass Scoring

**Julien:**
> As for your concern #6, LAST is used in the forward scheduling for priority scoring no?

**Claude:**
Yes, you're right again. I was wrong on #6 too. Re-reading the scoring:

```
FOREACH action where Eligibility = true
  score = bonus calage sur la base de machine [last action]
  Si LAST = T, score = 9999
```

LAST (from the backward pass) is directly used: when the forward pass reaches T = an action's latest allowable start time, that action gets score 9999, overriding any setup-alignment bonus.

So the two-tier priority system is:

1. **Normal operation**: actions compete on `bonus calage` (setup alignment) — minimize changeover waste
2. **Deadline pressure**: when T reaches an action's LAST, it trumps everything (score = 9999)

This is a clean design. Setup optimization handles efficiency, LAST handles correctness. And since the backward pass propagated deadline pressure through the entire dependency chain, an action's LAST already accounts for all downstream dependencies — it's not just the job's deadline, it's "the latest this specific action can start given everything that must happen after it."

That leaves my original concerns reduced to essentially three:

- **#1** — Greedy with no backtracking (but this is a pragmatic choice, not a flaw)
- **#4** — Attention model needs formalization (quantitative rules)
- **#5** — Multi-operator machines, machine capacity (acknowledged open questions)

The backward/forward interaction is better designed than I initially gave it credit for. The two passes complement each other well — backward computes deadlines, forward optimizes efficiency while respecting them.

---

### 4.3 — Performance: Language Change Impact

**Julien:**
> In PHP for around 300 tiles and no optimizations whatsoever it takes around 300 seconds to run for a time frame of around 3 weeks with a 5 minute tic. What is achievable by simply changing the language used?

**Claude:**
The workload: 3 weeks × ~10h/day × 60min / 5min tick = ~2,500 time slots. 300 actions × 2,500 slots = 750K outer-loop iterations minimum, plus sub-loops.

300 seconds for this in PHP is consistent. PHP's core bottlenecks for this workload:
- Arrays are hash maps (not contiguous memory) — every lookup is expensive
- Every variable is a heap-allocated zval — no value types
- Method dispatch overhead on each operator/action check
- GC pressure from millions of short-lived objects
- Even with PHP 8.x JIT, tight numerical loops remain 20-50x slower than compiled code

Realistic speedup factors (same algorithm, no optimizations, just a port):

| Language | Expected speedup | ~300s becomes | Notes |
|----------|-----------------|---------------|-------|
| **Rust** | 30-100x | **3-10s** | Contiguous arrays, zero-cost abstractions, no GC |
| **C++** | 30-80x | **4-10s** | Similar to Rust, depends on memory discipline |
| **Go** | 15-40x | **8-20s** | GC but value types, fast tight loops |
| **Java/Kotlin** | 15-50x | **6-20s** | JIT is excellent after warmup, GC pressure |
| **C# (.NET)** | 15-50x | **6-20s** | Similar to JVM |
| **Node.js/TS (V8)** | 5-15x | **20-60s** | V8 JIT is surprisingly good for numerical work |

The biggest single factor is data structure layout. This algorithm does millions of "is slot T available for operator O on machine M?" lookups. In PHP, that's a hash map traversal each time. In Rust/C/Go, it's a flat array index — literally `availability[machine_idx][slot_idx]`, a single memory offset calculation.

For an interactive scheduling tool where the user declares a constraint and expects the schedule to recalculate, you need under 5 seconds. That points to Rust or C++ as the compute engine. The 60x language gap between PHP and Rust is one of the largest you'll find in practical software — this type of workload (tight loops, array indexing, no I/O) is exactly where it matters most.

---

### 4.4 — Multi-Rate Ticks Per Machine

**Julien:**
> Does the algorithm described support having different tics per machines as long as they are multiples of one another?

**Claude:**
Yes, and it's a very clever optimization idea.

**How it would work:**
- Global tick = GCD of all machine ticks (e.g., 5 minutes)
- Each machine declares its own tick (e.g., Komori = 5min, MBO = 10min, Expédition = 30min)
- An action on a given machine is only eligible for evaluation when `T % (machine_tick / global_tick) == 0`
- ART decrements by the machine's tick × productivity, not the global Ut

This is a standard multi-rate simulation technique. The "multiples of each other" constraint guarantees synchronization at coarse boundaries — no alignment drift.

The big win is in the sub-loops. A 2-hour action:

| Machine tick | Iterations in sub-loop |
|---|---|
| 5 min | 24 |
| 10 min | 12 |
| 15 min | 8 |
| 30 min | 4 |

Correctness considerations:
1. **Precedence handoffs** — If a 5-min action finishes at T=17 and the next action is on a 30-min machine, it can't start until T=30. This is actually correct behavior — coarse machines naturally batch at their boundaries.
2. **Operator attention** — Tracked at the fine granularity. A coarse machine's "in progress" state persists across fine ticks where it isn't re-evaluated.
3. **Setup peremption** — SPR decrements at the machine's own tick rate. A 30-min machine whose setup expires after 2 hours = 4 ticks of peremption counter. This makes physical sense.

Combined with language change: 300s (PHP) → 100-150s (multi-rate alone in PHP) → 2-5s (Rust + multi-rate). That's interactive speed.

---

### 4.5 — Concern #4 & #5: Attention Model Resolves Multi-Operator Machines

**Julien:**
> Regarding your concern 4, machines have required levels of attention for full operation and masked time operation. Also, a machine could have attention required >1 which looks like it would solve the issue of machines with more than one operator required no?

**Claude:**
That's elegant. It collapses three separate problems into one unified model.

Each **machine** declares attention requirements per mode:

| Machine | Full operation | Masked time |
|---|---|---|
| Komori (offset press) | 1.0 | 0.3 |
| Large Komori (5-color) | 1.5 | 0.5 |
| MBO (folder) | 0.8 | 0.2 |
| Polar (cutter) | 1.0 | — |
| Expédition (shipping) | 2.0 | — |

Each **operator** has attention = 1.0 to distribute across machines per time slot.

What falls out naturally:
- **Single operator, one machine**: Komori needs 1.0, operator gives 1.0 → nominal mode
- **One operator, two machines**: Komori full (1.0) + MBO masked (0.2) = 1.2 > 1.0. Operator can't cover both at full spec. Either Komori gets 0.8 (degraded, 80% productivity) or need a second operator
- **Multi-operator machine**: Large Komori needs 1.5. Operator A gives 1.0, Operator B gives 0.5 → 1.5/1.5 = nominal. Operator B still has 0.5 attention available for a folder in masked time
- **Heavily manual operation**: Shipping needs 2.0 → requires 2 full operators. One operator alone = 50% productivity
- **Near-autonomous machine**: Digital press needs 0.2 → one operator can supervise five simultaneously

This answers every open question from the document's margin notes:

| Question | Answer via attention model |
|---|---|
| "Max operators per machine?" | `ceil(machine.attention_required)` |
| "Machines requiring 2 operators?" | `attention_required = 2.0` |
| "How is attention split?" | Machines declare needs, algorithm allocates operator attention to satisfy them |
| "Degraded vs nominal quantitatively?" | `productivity = min(attention_received / attention_required, 1.0)` |

My concerns #4 and #5 are resolved. The attention model was already formalized — through machine-declared requirements, not operator-declared capacity. I was looking at it from the wrong side.

---

### 4.6 — FBI (Feedback-Based Improvement) Interaction

**Julien:**
> How would FBI benefit this algorithm pair? Would it?

**Claude:**
Yes, and actually FBI would be more beneficial here than in the current Flux autoplace, specifically because of the backward pass.

In the current Flux autoplace, FBI only adjusts durations between iterations. The scheduling logic stays the same.

Here, FBI adjusts durations which feed into the backward pass, which recomputes LAST values, which changes the priority ordering in the forward pass. The feedback cascades through both passes:

```
Run 1:
  Backward pass: LAST computed with nominal durations
  Forward pass: greedy schedule → discovers degraded durations, re-setups

Run 2:
  Backward pass: LAST recomputed with actual durations from run 1
    → some actions now have EARLIER deadlines (tighter LAST)
    → priority ordering changes
  Forward pass: different actions get bottleneck machines first
    → different operator assignments → different attention splits
    → different schedule

Run 3:
  Converging toward stable durations + stable LAST values + stable schedule
```

The backward pass amplifies the FBI signal. Without it (current Flux), feedback only affects "how long is each tile." With it, feedback affects "which action gets priority" — a structurally different schedule, not just the same schedule with adjusted durations.

What FBI fixes concretely:
1. **Degraded mode convergence** — Run 1 assumes full attention. Actual schedule splits attention, making some actions slower. Run 2 budgets correct time.
2. **Setup peremption accounting** — Run 1 doesn't know which actions will be interrupted. Run 2 accounts for longer durations from re-setups.
3. **Bottleneck smoothing** — If run 1 overloads a machine, tighter LAST values in run 2 push some actions earlier.

What FBI doesn't fix: the fundamental combinatorial problem of which operator goes to which action. Each run is still greedy. For that you'd need a metaheuristic or CP solver. But FBI gives 80% of the benefit at 1% of the implementation complexity.

Expected convergence: 2-4 iterations, similar to current Flux FBI. Durations stabilize quickly because degraded mode is bounded (attention ∈ ]0,1]) and setup peremption is binary.

---

### 4.7 — Rolling Window Approach

**Julien:**
> Does a rolling window approach make sense from a performance and practical point of view? Would it even be compatible with this approach?

**Claude:**
Yes, but the key insight is it must be **asymmetric** — and this reveals something important about the algorithm's structure.

**The problem with a naive rolling window:** The backward pass needs the full horizon. A job with a deadline in week 3 creates urgency NOW for its early actions. Truncating the backward pass would destroy the algorithm's key strength.

**What works: asymmetric windowing.** The backward pass is cheap — single traversal, no sub-loops, no operator checks. The forward pass is where 99% of compute goes.

| Pass | Scope | Cost |
|---|---|---|
| **Backward** | Always full horizon | Cheap — O(A), negligible |
| **Forward** | Rolling window with tiered resolution | Expensive — this is what you optimize |

The forward pass could use tiered resolution (combining multi-rate ticks):
- **Days 1-3**: full detail, 5-min tick, operator attention model, setup peremption
- **Days 4-7**: medium detail, 15-min tick, operator assigned but no attention splitting
- **Week 2-3**: coarse, 30-min tick, machine allocation only, no operators

This mirrors how production managers actually think:
- **Today + tomorrow**: "Jean is on the Komori, Marie covers MBO, we need to finish the AFVAC brochure by 14h"
- **This week**: "We have a bottleneck on the Hohner Thursday"
- **Next week+**: "Rough capacity looks OK"

FBI convergence also benefits — iterate over 3 days × ~60 actions instead of 3 weeks × 300 actions.

Performance estimate for near-term window (3 days instead of 3 weeks):
- Time slots: ~360 instead of ~2,500 (7x fewer)
- Actions in window: ~60 instead of 300 (5x fewer)
- Combined: ~35x fewer forward-pass iterations
- In PHP: 300s → ~10s for near-term recompute
- In Rust: sub-second

That's genuinely interactive. User declares a constraint, system recalculates in under a second.

---

### 4.8 — Task Splitting / Interleaving (OPEN)

**Julien:**
> Now I would like to check something: does the algorithm allow for, for example, splitting a long let's say 20 hour printing task into 4 tasks for a slightly longer total time (setup might be totally or partially added back)? I mean would it be able to result in a schedule where naturally the algorithm would do this long printing haul 3 nights in a row with other printing tasks in between during the day?

**Claude:**
Almost, but not quite as written — and the fix would be a simplification. The sub-loop (`REPEAT UNTIL ART = 0`) monopolizes the machine until the action completes. It won't voluntarily yield to let other tasks interleave.

However, all the OTHER pieces are already there:
- Setup peremption handles the COST of interrupting and resuming
- LAST-based scoring (9999) handles WHEN to preempt
- Calage bonus handles WHY to continue
- ART tracking makes actions resumable
- EAT tracking triggers setup peremption

The proposed fix: remove the sub-loop entirely, process one Ut per action per timestep:

```
T = 0
Repeat until sum(ART) = 0
  FOREACH machine
    Score eligible actions for this machine
    Pick highest-scoring action
    If switching actions: check setup peremption
    Assign Ut: operator, machine, decrement ART
  FOREACH operator: attention recalculation
  T = T+1
```

This would enable natural interleaving: during the day, if an urgent job's LAST approaches (score 9999), it preempts the long job. At night or when no urgent work exists, the long job resumes. Setup peremption handles the re-setup cost.

**Julien pushed back:**
> Isn't this already what happens? Why would the current sub-loop prevent it? Does it really?

**Claude (detailed trace):**

Scenario:
- **Action A**: 20-hour print job on Komori, LAST = day 5 (not urgent)
- **Action B**: 2-hour urgent job on Komori, LAST = day 2 afternoon
- Operators available 06:00-16:00 every day

What happens:

**T = day 1, 06:00**: Both A and B are eligible. Scoring:
- A: calage bonus (say 500)
- B: calage bonus (say 300). B's LAST is day 2 — not yet T, so no 9999

A scores higher, processes first. Enters sub-loop.

**Sub-loop runs forward**, assigning A to the Komori at each Ut:
- Day 1 06:00-16:00: resources available → assigns A, decrements ART
- Day 1 16:00: no operator → resource check fails → **LAST check**: is B's LAST exceeded? T = day 1 evening, B's LAST = day 2 afternoon → **not exceeded** → setup peremption handling, T+1
- Night: no resource, LAST not exceeded, T keeps advancing
- Day 2 06:00: operator returns → assigns A again
- Day 2 afternoon: resource check still passes (operator working until 16:00) → A keeps going → **B's LAST passes silently** because A has resources
- Day 2 16:00: no operator → LAST check → B's LAST IS now exceeded → **dégradé KO** → rollback

But B's LAST was already exceeded during the day while A had resources. The LAST check only fires in the "no resource" branch.

**The gap:** The LAST check is inside the `NON` (no resource) cascade:

```
resource available? → OUI → assign (no LAST check)
                    → NON → ... → NON → LAST exceeded? → dégradé KO
```

When A has continuous resources (operator available all day), the `OUI` branch fires and no LAST check occurs. B's deadline can pass unnoticed during working hours.

**Three possible resolutions** (awaiting Julien's clarification):

1. The resource check considers machine contention globally — "resource available" means not just "operator exists" but also "no higher-priority action needs this machine right now." If so, B's approaching LAST would make the resource check fail for A.
2. The sub-loop doesn't make real assignments — it's a projection that gets committed only on success. If so, B could still claim the machine at T-Main.
3. There's a preemption check at the `OUI` branch that isn't captured in the PDF.

**Status: RESOLVED — see §4.9 and §4.10 for the full discussion and agreed approach.**

---

### 4.9 — Sub-Loop Anti-Fragmentation vs. Preemption

**Claude proposed removing the sub-loop** in favor of a per-Ut simulation with a scoring hierarchy (continuation bonus = 5000, LAST = T → 9999). This would enable natural preemption: urgent actions override the continuation bonus, setup peremption handles interruption costs.

**Julien pushed back:**
> But the loop aims at avoiding having too fragmented tasks. What is your answer for this?

**Claude acknowledged the concern:**
The sub-loop isn't just an optimization — it's an anti-fragmentation guarantee. Removing it trades a guarantee for a preference (the continuation bonus). Even with a high continuation score, the guarantee is gone.

**Claude proposed a "minimum run commitment"** — a per-machine minimum number of Uts before re-scoring. This preserves most of the anti-fragmentation property while allowing preemption at commitment boundaries:

```
IF machine has a current action AND committed Uts remaining > 0:
  Continue current action (no re-scoring)
ELSE:
  Re-score, pick best action
  Set committed_run = min(ART, machine.minimum_run_length)
  EXCEPTION: shorten commitment if another action's LAST falls within the window
```

With per-machine thresholds (Komori = 60 min, MBO = 15 min, Polar = 5 min). This is a tunable dial between anti-fragmentation and preemption responsiveness.

---

### 4.10 — Pre-Split Long Tasks (AGREED APPROACH)

**Julien proposed a simpler solution:**
> How about arbitrarily saying that very long tasks are to be fragmented to not be longer than 7 hours BEFORE running the algorithm, subloop included? This way if there is room, because of their bonus scores, the tasks would run consecutively without allowing other tasks to be needlessly broken up.

**Claude's assessment: this is a better solution than removing the sub-loop or adding minimum run commitment.** It leverages everything the algorithm already does without changing a single line:

**Why it works:**

1. **Calage bonus makes chunks glue together.** When chunk 1 finishes, chunk 2 becomes eligible (precedence satisfied), targets the same machine with the same setup. Maximum calage bonus. Unless something with LAST = T needs the machine, chunk 2 runs immediately. No changeover, no re-setup. From the machine's perspective, it's as if the task was never split.

2. **The sub-loop stays, with its anti-fragmentation guarantee.** Each 7-hour chunk runs to completion within the sub-loop. No frivolous switching within a chunk.

3. **Interleaving happens at chunk boundaries, not Ut boundaries.** If an urgent task needs the machine between chunks, it gets scored, wins, runs its sub-loop, finishes. Then the next chunk takes over. Clean, predictable, no churn.

4. **The backward pass propagates deadlines correctly through chunks.** A 20-hour job split into chunks 1/2/3 with precedence: the backward pass computes LAST for chunk 3 (from deadline), then chunk 2 (from chunk 3's LAST), then chunk 1 (from chunk 2's LAST). Deadline urgency propagates naturally.

5. **Setup peremption handles interruption costs automatically.** If an urgent task runs between chunks and the gap exceeds the machine's peremption threshold, re-setup time is added. If the gap is short enough, no penalty. Zero special handling needed.

**Concrete trace — 20-hour Komori job split into 7h + 7h + 6h:**

*No contention case:*
- Day 1: chunk 1 runs 06:00-13:00. Chunk 2 scores highest (calage). Runs 13:00-16:00 (3h done). Sub-loop continues next morning.
- Day 2: chunk 2 finishes by 10:00. Chunk 3 runs 10:00-16:00. Done.
- Total: 20 hours. Zero re-setup. Identical to unsplit behavior.

*With urgent work:*
- Day 1: chunk 1 runs 06:00-13:00. Completes.
- Day 1 13:00: urgent 2-hour job has LAST approaching. Scores 9999. Takes the Komori. Finishes 15:00.
- Day 1 15:00: chunk 2 scores highest (calage bonus). Starts. Runs 15:00-16:00 (1h). Sub-loop continues next morning.
- Day 2: chunk 2 finishes by 12:00. Chunk 3 runs 12:00-16:00 (4h). Day 3 finishes last 2h.
- Total: 20h + maybe 30min re-setup after the interruption. Urgent job handled gracefully.

**Refinement — per-machine threshold:**

The 7-hour threshold could be per-machine, since monopolization cost is machine-dependent:

| Machine | Max chunk | Rationale |
|---|---|---|
| Komori (offset press) | 7h | Expensive setup, long runs normal |
| MBO (folder) | 4h | Moderate setup, shorter jobs typical |
| Polar (cutter) | 2h | Quick setup, many short jobs |
| Expédition (shipping) | 8h | Batching is efficient, splitting is wasteful |

A flat 7 hours is a good starting point — it fits within a working day (~10h), leaving ~3 hours for other work.

**Precedence between chunks is required.** Without it, two things break:

1. **The backward pass computes wrong LAST values.** Without precedence, all chunks independently compute LAST from the job deadline — they all get the same LAST. The algorithm doesn't know chunk 1 must finish before chunk 2, so urgency doesn't propagate backward. With precedence (chunk 1 → chunk 2 → chunk 3), LAST correctly cascades: chunk 3 from deadline, chunk 2 from chunk 3's LAST, chunk 1 from chunk 2's LAST.

2. **The forward pass can't guarantee ordering.** Without precedence, all chunks are eligible at T=0 with identical scores (same machine, same setup). Tiebreaker is arbitrary. With precedence, only chunk 1 is eligible at T=0. Chunk 2 becomes eligible when chunk 1 completes — correct sequencing is guaranteed.

Pre-processing implementation:

```
split_task(action, max_chunk_duration):
  chunks = divide action into N chunks
  for i in 1..N-1:
    add_precedence(chunks[i] → chunks[i+1])
  replace original action's outgoing precedence links with chunks[N]'s
  replace original action's incoming precedence links with chunks[1]'s
  return chunks
```

The precedence also makes calage work correctly: chunk 2 enters the eligibility pool at the exact moment chunk 1 finishes, gets maximum calage bonus (same machine, same setup), and runs immediately if no urgent work preempts it.

**Setup cost for split chunks:**

Chunks 2+ have ART = chunk_duration (no extra setup baked in). If they run consecutively (calage bonus), no setup needed — the machine state is preserved. If interrupted, setup peremption adds re-setup time dynamically. The algorithm's existing mechanism handles it.

**Why this beats the alternatives:**

| | Pre-split + sub-loop | Remove sub-loop | Minimum run commitment |
|---|---|---|---|
| Algorithm changes | **None** | Structural rewrite | New state management |
| Anti-fragmentation | **Guaranteed** (sub-loop intact) | Preference only | Strong but not guaranteed |
| Complexity | Simple pre-processing step | Simpler core loop but new scoring | New commitment logic |
| Setup handling | Existing mechanisms | Same | Same |
| Predictability | Chunks visible in schedule | Implicit decisions | Implicit windows |

**Status: AGREED — pre-split long tasks as a pre-processing step, sub-loop preserved.**

---

## 5. Open Topics

### 5.1 — Sub-Loop LAST Check in OUI Branch (INFORMATIONAL)

**Context (from §4.8):** The sub-loop's LAST check only fires in the "no resource" branch. When a long action has continuous resources, another action's LAST can pass unnoticed during working hours.

**Impact with pre-split approach:** Significantly reduced. With a 7-hour max chunk, the worst case for monopolization is 7 hours, not 20. If another action's LAST falls within a 7-hour window and the sub-loop doesn't catch it, the delay is at most 7 hours — much less severe.

**Still worth investigating:** Whether the resource check implicitly considers contention (which would make this a non-issue entirely), or whether a LAST check should be added to the OUI branch as a safety net. Lower priority now that pre-splitting limits exposure.

### 5.2 — Pre-Split Implementation Details

**Confirmed requirements:**
- Chunks MUST have precedence relationships (chunk 1 → chunk 2 → chunk 3) — required for correct LAST computation in backward pass and correct ordering in forward pass
- Original action's incoming precedence links transfer to chunk 1, outgoing links transfer to last chunk
- Chunks 2+ have no extra setup baked into ART — setup cost is handled dynamically by calage (free if consecutive) and setup peremption (adds re-setup if interrupted too long)

**Remaining open questions:**

1. **Threshold source:** Global constant, per-machine configuration, or derived from working day length?
2. **Split granularity:** Equal chunks (7h + 7h + 6h) or working-day-aligned chunks (split at end-of-day boundaries)?
3. **Minimum task length to split:** Only split tasks > threshold, or also split tasks marginally above (e.g., 7.5h → split into 4h + 3.5h)?
4. **Naming/identity:** How are chunks identified in the schedule? (e.g., "AFVAC Interior [1/3]", "AFVAC Interior [2/3]")
5. **Recombination for display:** Should the UI recombine chunks into a single visual tile when they run consecutively, or show them as separate tiles?

### 5.3 — FBI Convergence with Pre-Split Tasks

FBI becomes slightly more important with pre-split tasks: the first run might schedule chunks with gaps between them (triggering re-setup). FBI iteration 2 would account for the longer total duration (original + re-setup) in the backward pass, potentially adjusting LAST values and priority ordering to schedule chunks closer together — reducing re-setup costs in subsequent iterations.

### 5.4 — Comparison Table: Current Flux vs. This Algorithm

| Aspect | Current Flux | This Algorithm |
|--------|-------------|----------------|
| Granularity | Task-level tiles | Time-slot level (Ut) |
| Operator | Post-placement (separate step) | Integrated with placement |
| Productivity | Uniform 1.0 (MVP) | Variable via attention model |
| Setup/Makeready | Not modeled | Setup peremption + masked time |
| Scheduling direction | Forward greedy | Backward (LAST) + Forward |
| Task interruption | Tasks are atomic blocks | Tasks can be interrupted/resumed |
| Multi-machine operator | Not supported | Attention model supports it |
| Multi-operator machine | Not supported | Attention > 1.0 |
| Optimization | Greedy, no backtracking | Greedy, no backtracking (but FBI amplified by backward pass) |
| Implementation | Working in production | Conceptual/design phase |
| Performance target | N/A (tile-based, instant) | Sub-second in Rust with optimizations |

### 5.5 — Performance Optimization Stack

| Optimization | Speedup | Cumulative from 300s PHP |
|---|---|---|
| Language change (→ Rust) | 30-100x | 3-10s |
| Multi-rate ticks per machine | 2-3x | 1-5s |
| Rolling window (near-term only) | 5-7x | 0.2-1s |
| Algorithmic (data structures, caching) | 2-5x | 0.05-0.5s |

### 5.6 — Relationship to Constraint-Based Vision

The algorithm as designed is a **deterministic greedy heuristic** — not a constraint-programming solver. However, it is highly compatible with Julien's constraint-based vision:

- User constraints (machine downtime, operator absence, duration override, pinned start) translate directly to algorithm inputs
- The algorithm recalculates the full schedule from those inputs
- FBI iteration converges to stable results
- Interactive speed is achievable with the optimization stack

The missing piece vs. a true CP solver: no global optimization, no backtracking, no exploration of the combinatorial space. But the practical benefit of a CP solver over this heuristic + FBI may be marginal for the scale of a print shop (300 actions, 12 machines, 20 operators). CP solvers shine at 10,000+ variables.

### 5.7 — Outsourced Actions

Outsourced actions (work sent to external providers — lamination, special finishing, etc.) are naturally handle-able without algorithm changes. An outsourced action is a **time delay in the precedence chain** that consumes no internal resources.

#### How outsourced actions fit the model

| Property | Internal action | Outsourced action |
|---|---|---|
| Machine | Internal station (Komori, MBO...) | None (or "virtual provider") |
| Attention required | 0.3 - 2.0 | **0** (no operator needed) |
| Duration | Variable (productivity × attention) | **Fixed** (provider lead time) |
| Setup / calage | Yes | **No** |
| Capacity | 1 action per machine at a time | **Unlimited** (provider's problem) |
| Precedence | Normal | Normal |

#### Two modeling approaches

**Approach A: Precedence delay node (simplest).** Outsourced actions aren't "scheduled" at all. They're time gaps in the precedence chain. When all prerequisites complete at time T, the outsourced action "starts." Its successor actions become eligible at T + provider_lead_time. No machine assignment, no operator assignment, no scoring, no sub-loop. The backward pass still computes LAST through them (they have duration, so deadline pressure propagates correctly).

**Approach B: Virtual machine with attention = 0.** Model the provider as a "machine" with attention required = 0, unlimited capacity, fixed duration, no setup, no calage, and a coarse tick (daily). Advantages: outsourced work is visible in the schedule timeline ("lamination at Provider X, days 5-8"), and allows future extensions like provider capacity limits ("our laminator can handle max 3 jobs concurrently").

#### What already works with both approaches

- **Backward pass:** LAST computation propagates through outsourced actions. If deadline = day 15, last internal action = 2 days, outsourced lamination = 3 days, print run = 2 days → print LAST = day 15 - 2 - 3 - 2 = day 8. Correct.
- **Forward pass:** Outsourced actions either skip scoring entirely (approach A) or score on a virtual machine with no contention (approach B). No competition for internal resources.
- **Pre-splitting:** Not applicable — outsourced durations are fixed by the provider.
- **Multi-rate ticks:** Outsourced actions naturally fit a coarse tick (daily or half-daily). No need for 5-minute granularity on "waiting for external provider."
- **FBI:** Less relevant (duration is provider-determined). Could adjust if historical data shows a provider consistently takes 4 days instead of 3.

#### Real-world nuance: pickup/delivery windows

Outsourcing involves logistics beyond just duration:
- "We can only send work to the laminator on Tuesdays and Thursdays" (pickup schedule)
- "Provider delivers back within 48h of receiving" (lead time)
- "Delivery arrives at 09:00" (fixed arrival time)

These translate to constraints expressible within the existing model:
- Outsourced action can only START on eligible days → modeled as operating schedule on the virtual machine (pickup days = operating days)
- Duration = transport time + processing time + return transport
- Successor eligibility aligned to delivery time

The algorithm's existing operating schedule mechanism handles pickup windows naturally when using approach B (virtual machine).

#### Recommendation

Start with **approach A** (precedence delay) for simplicity. Migrate to **approach B** (virtual machine) when provider visibility in the schedule or provider capacity limits become requirements.

---

### 5.8 — Implementation Language Decision

Not yet decided. Candidates:

| Language | Pros | Cons |
|---|---|---|
| **Rust → WASM** | Fastest (3-10s → sub-second with optimizations). Could run server-side or in browser. | New tooling for the team. Learning curve. |
| **Go microservice** | Good performance (8-20s). Simple language. Easy deployment alongside PHP API. | Not as fast as Rust. Another service to maintain. |
| **Node.js/TypeScript** | Already in stack. V8 decent for numerical work (20-60s). | Slowest of the three. May not hit interactive speed targets for large schedules. |
| **Rust called from PHP via FFI** | Fastest. No separate service. | Complex integration. PHP process lifecycle constraints. |

### 5.9 — Masked Time

#### Definition

"Temps masqué" (masked time) is the **run phase** of an action on a machine — the period after setup is complete where the machine runs production and only requires monitoring. During masked time, the machine's attention requirement drops from full to masked level, partially freeing the operator's attention.

The algorithm note "toute action pouvant être réalisée en temps masqué l'est d'office" means: the algorithm automatically fills freed operator attention with eligible work. Masked time is not a special mechanism — it is an **emergent behavior** of the attention model.

#### Action lifecycle on a machine

Every action goes through two phases on its machine:

| Phase | Condition | Machine attention | Operator state | Maskable? |
|---|---|---|---|---|
| **Setup** | `EAT <= setup_time` | Full (e.g., 1.0) | Fully focused — calibrating, adjusting, aligning | **No** |
| **Run** | `EAT > setup_time` | Masked (e.g., 0.3) | Monitoring — partially freed | **Yes** |

**Key rule: for any action, setup is NOT maskable. Only the run phase is.** The setup phase of any action — whether it's the first action on a machine or a subsequent one — always demands full attention on that machine.

#### How masked time creates parallel work

When a machine enters its run phase:

1. Machine A running Job X, `EAT > setup_time` → attention drops from 1.0 to 0.3
2. Operator has 0.7 attention freed
3. Normal per-Ut scoring finds eligible actions that fit within 0.7 attention
4. Whatever gets scheduled with that freed attention IS the masked-time work

There is no "maskable" flag on actions. Any eligible action that fits within the available attention is a candidate. The algorithm's normal scoring and attention allocation handles everything.

#### Attention arithmetic constraint

Because setup is not maskable, starting a new action on another machine consumes real attention for that action's setup phase. The freed attention from masked time must be sufficient:

**Example — works:**
- Machine A (Komori) in run phase: attention = 0.3. Operator has 0.7 freed.
- Machine B (preparation station) needs setup: attention_full = 0.5.
- 0.7 >= 0.5 → operator can set up machine B while monitoring A. Both progress.

**Example — doesn't work without help:**
- Machine A (Komori) in run phase: attention = 0.3. Operator has 0.7 freed.
- Machine B (large press) needs setup: attention_full = 1.0.
- 0.7 < 1.0 → operator alone cannot set up B while monitoring A.
- Options: second operator contributes attention, or wait until A finishes to set up B at full attention.

**Example — two machines in run phase:**
- Machine A in run phase: attention = 0.3
- Machine B in run phase: attention = 0.2
- Operator monitoring both: 0.3 + 0.2 = 0.5. Has 0.5 freed.
- Can start setup on machine C if attention_full <= 0.5.

#### What masked time achieves in practice

The primary benefit: **reduced effective changeover between jobs on the same machine**.

When Job X enters its run phase on machine A, the operator's freed attention can be used to prepare for Job Y on a different machine or station. When Job X finishes, the preparation work for Job Y is already partially or fully done — reducing the gap between jobs.

This happens automatically through the scoring mechanism. No special "masked time scheduling" logic is needed. The algorithm just sees freed attention and fills it with the highest-scoring eligible work. If that work happens to be preparation for the next job, changeover time is reduced. If it's monitoring another running machine, that's multi-machine supervision. Same mechanism.

#### Remaining open questions

1. **Same-machine preparation:** Can preparation for the NEXT job on the same machine happen during the current job's run phase? In reality, some preparation can happen on the same physical machine (loading paper on an unused feeder, pre-staging ink). This would require the job model to separate "prepare" from "print" as distinct actions on different logical resources (physical press vs preparation area). The algorithm handles it through normal attention allocation — but the job model must support it.

2. **Setup time reduction from masked-time preparation:** If plates for Job Y were prepared during Job X's run phase, does Job Y's setup_time on the machine decrease? Options:
   - Setup time is fixed (simple, but doesn't capture the benefit of parallel preparation)
   - Setup time is reduced by the amount of preparation completed in masked time (accurate, but requires tracking preparation progress and its effect on setup duration)
   - Preparation is a separate precedence action; Job Y's machine setup is short because plates are already done (cleanest — preparation and setup are distinct actions with a precedence link)
