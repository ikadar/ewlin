# Plan d'implémentation — Saisie d'avancement opérateur (V2)

**Date** : 2026-05-01
**Branche** : `ameliorations-ux-ia` (rester dessus)
**Doc design de référence** : `docs/operator-sandbox/progress-capture-design.md`
**Playground de référence** : `playgrounds/tile-prompts-and-menu.html` (avec **variante jauge** active pour la modale)

## 1. Vue d'ensemble

Refonte complète de l'UX de saisie d'avancement, validée en session du 2026-05-01. Cette implémentation remplace la case à cocher binaire actuelle (`CompletionToggleIcon`) par :

- **Icône saisie** sur la tuile (3 états : inactif / hourly / tile-end)
- **Pulses tuile-level** : opacité pour hourly, orange pour tile-end (1,6 s synchronisé)
- **Modale d'avancement** avec saisie unique (heure de fin estimée)
- **Jauge 100% du job avec créneau isolé** comme représentation du volume attendu (variante validée)
- **Layout en T** dans la modale : « À l'heure » massif + 6 ajustements symétriques (-1h, -30, -15, +15, +30, +1h) + champ personnalisé
- **Menu contextuel nettoyé** pour la prod (4 items)
- **Sub-dialog « Définir heure de début… »** avec calendrier + sélecteur 15 min + faisabilité live
- **Auto-completion dérivée** (`scheduledEnd < now` ⇒ tuile considérée terminée)
- **Triggers automatiques** : hourly + tile-end ⇒ icône colorée + tuile pulsante (planning view) OU modale auto-ouverte (focus mode)

## 2. Architecture cible

```
Frontend (apps/web/src)
  ├── components/
  │   ├── Tile/
  │   │   ├── Tile.tsx                (modifié — remplace CompletionToggleIcon)
  │   │   ├── SaisieIndicator.tsx     (nouveau — 3 états)
  │   │   ├── TileContextMenu.tsx     (refactoré — items pertinents par contexte)
  │   │   └── colorUtils.ts           (modifié — auto-completion dérivée)
  │   ├── ProgressCaptureModal/
  │   │   ├── ProgressCaptureModal.tsx
  │   │   ├── VolumeGauge.tsx         (jauge 100% job avec slot isolé)
  │   │   ├── QuickActionsRow.tsx     (À l'heure + 6 ajustements)
  │   │   ├── CustomTimeStepper.tsx
  │   │   └── StatusLine.tsx
  │   └── SetStartTimeDialog/
  │       ├── SetStartTimeDialog.tsx
  │       ├── CompactCalendar.tsx
  │       ├── TimePicker15min.tsx
  │       └── FeasibilityPreview.tsx
  ├── hooks/
  │   └── useProgressTriggers.ts      (hourly tick + tile-end watcher)
  └── store/api/
      ├── saisieApi.ts                (nouveau)
      ├── scheduleAtTimeApi.ts        (nouveau, pin paramétré)
      ├── feasibilityPreviewApi.ts    (nouveau, live preview)
      └── prodCompletionApi.ts        (deprecated, retiré en fin de migration)

PHP API (services/php-api)
  ├── Controller/
  │   └── ProgressCaptureController.php
  │       ├── POST /scenarios/prod/saisie/{taskId}
  │       ├── POST /scenarios/prod/pin/{taskId}
  │       └── POST /schedule/feasibility-preview
  └── Service/
      └── EngineProbeService.php       (wrappers vers feasibility_probe Rust)

Rust engine (services/scheduling-engine)
  ├── productivity::ratio_run_only()             (modifié)
  ├── propagation::apply_run_ratio_to_fragments() (nouveau ou refactoré)
  ├── feasibility::probe()                       (nouveau, expose pre_place_pinned sans muter)
  └── fragments::cumulative_position()           (nouveau, pour la jauge)
```

## 3. Flux complet end-to-end

```
Opérateur                           Frontend                          Backend                          Engine
   │                                   │                                 │                                │
   │  click icône saisie OU            │                                 │                                │
   │  hourly tick OU tile-end ─────► useProgressTriggers                │                                │
   │                                   │                                 │                                │
   │                                   │  ouvre ProgressCaptureModal     │                                │
   │  click "À l'heure"  ────────────► QuickActionsRow                  │                                │
   │  click Enregistrer ────────────► useReportSaisieMutation           │                                │
   │                                   │   ─POST /saisie/{taskId} ─────► ProgressCaptureController       │
   │                                   │                                 │  ─compute() ────────────────► engine
   │                                   │                                 │                                │  apply_run_ratio
   │                                   │                                 │                                │  propagate
   │                                   │                                 │                                │  replan
   │                                   │                                 │ ◄────── new snapshot ─────────│
   │                                   │ ◄─── 200 + new snapshot ───────│                                │
   │                                   │  invalidate cache, replan       │                                │
   │                                   │  modal existant 3-5s            │                                │
   │  voit nouveau planning ◄──────── render avec scheduledEnd MAJ      │                                │
   │                                   │                                 │                                │
```

## 4. Phase 1 — Moteur Rust

### 4.1 Décomposition calage/roule du ratio (cf. `project_calage_run_ratio.md`)

```rust
// services/scheduling-engine/src/productivity.rs

pub fn ratio_run_only(
    setup_min: u32,
    elapsed_min: u32,
    planned_run_min: u32,
    projected_total_min: u32,
) -> f64 {
    let new_run = (projected_total_min as i32 - setup_min as i32).max(0);
    if new_run == 0 || planned_run_min == 0 { return 1.0; }
    new_run as f64 / planned_run_min as f64
}

pub fn fragment_new_duration(setup_min: u32, run_min: u32, ratio: f64) -> u32 {
    setup_min + (run_min as f64 * ratio).round() as u32
}
```

### 4.2 `feasibility::probe`

```rust
// services/scheduling-engine/src/feasibility.rs

pub struct FeasibilityResult {
    pub feasible: bool,
    pub resolved_tick: u32,
    pub reason: Option<InfeasibilityReason>,
}

pub enum InfeasibilityReason { Closure, CapacityFull, DependencyUnresolved }

pub fn probe(grid: &ScheduleGrid, task_id: &str, target_tick: u32) -> FeasibilityResult {
    let mut probe_grid = grid.clone();
    let resolved = pre_place_pinned(&mut probe_grid, task_id, target_tick);
    FeasibilityResult {
        feasible: resolved == target_tick,
        resolved_tick: resolved,
        reason: if resolved != target_tick { Some(infer_reason(grid, task_id, target_tick)) } else { None },
    }
}
```

### 4.3 `fragments::cumulative_position`

```rust
// services/scheduling-engine/src/fragments.rs

pub fn cumulative_position(plan: &Plan, fragment_id: &str) -> CumulativePosition {
    let total = plan.job_total_volume(fragment_id.job_id());
    let cumul_before: f64 = plan.fragments_before(fragment_id)
        .map(|f| f.run_minutes_with_ratio() as f64)
        .sum();
    CumulativePosition {
        cumul_before_pct: cumul_before / total,
        slot_volume_pct: plan.fragment_volume(fragment_id) / total,
    }
}
```

### 4.4 Tests Rust

- `tests/productivity_ratio_run_only.rs` — 5 cas : setup=0 / setup_long / retard / avance / new_run<0 (clamp)
- `tests/feasibility_probe.rs` — closures / capacité saturée / dépendance non résolue
- `tests/fragments_cumulative.rs` — premier fragment / milieu / dernier / job mono-fragment

## 5. Phase 2 — PHP API

### 5.1 Endpoint saisie

`POST /api/v1/scenarios/prod/saisie/{taskId}`

```php
// services/php-api/src/Controller/ProgressCaptureController.php

public function saisie(string $taskId, Request $request): JsonResponse
{
    $body = json_decode($request->getContent(), true);
    $estimatedEnd = new \DateTimeImmutable($body['estimatedEndTime']);

    // 1. Validation
    $assignment = $this->assignmentRepository->find($taskId);
    if (!$assignment) return $this->json(['error' => 'task not found'], 404);

    // 2. Update scheduledEnd + audit
    $assignment->setScheduledEnd($estimatedEnd);
    $assignment->setLastSaisieAt(new \DateTimeImmutable('now'));
    $this->auditLog->record('saisie', $taskId, $body, $this->security->getUser());

    // 3. Trigger replan (run_only ratio + propagation)
    $newSnapshot = $this->engineService->replanWithSaisie($assignment);

    // 4. Persist + return
    $this->em->flush();
    return $this->json(['snapshot' => $newSnapshot]);
}
```

PHPStan level 8. PHPUnit : auth / validation / replan trigger / audit log.

### 5.2 Endpoint pin paramétré

`POST /api/v1/scenarios/prod/pin/{taskId}` avec `{ targetDateTime }`

Reçoit la cible jour/heure du sub-dialog, appelle l'engine pour pin (qui résout via slide-to-nearest si infaisable), retourne `{ pinned: true, scheduledStart, slidWith?: reason }`.

### 5.3 Endpoint feasibility preview

`POST /api/v1/schedule/feasibility-preview` avec `{ taskId, targetDateTime }`

Wrap autour de `engine.feasibility::probe()`. Retourne `{ feasible, resolvedDateTime, reason }`. **Non-mutant** côté DB et engine.

## 6. Phase 3 — Frontend

### 6.1 SaisieIndicator (nouveau)

`apps/web/src/components/Tile/SaisieIndicator.tsx`

```tsx
type SaisieState = 'inactive' | 'hourly' | 'tile-end';

interface Props {
  state: SaisieState;
  onClick: () => void;
}

// Render: petit cercle 14px, état styling :
//   inactive  → border 1.5px gray @ 55% opacity
//   hourly    → background blue-500 plein
//   tile-end  → background amber-500 + animation pulse-amber 1.6s ease-in-out infinite
```

### 6.2 Tile.tsx — modifs

```tsx
// Avant : <CompletionToggleIcon ... />
// Après : <SaisieIndicator state={saisieState} onClick={() => openProgressModal(taskId)} />

// Tile-level pulse classes (calculées par useProgressTriggers) :
//   if (state === 'hourly')   className += ' tile-hourly-active';   // animation pulse-tile-opacity 1.6s
//   if (state === 'tile-end') className += ' tile-end-active';      // animation pulse-tile-attention 1.6s (orange)
```

### 6.3 ProgressCaptureModal (nouveau)

`apps/web/src/components/ProgressCaptureModal/ProgressCaptureModal.tsx`

Réplique fidèle du dialog `pm-overlay` du playground. Tokens Flux. Vouvoiement intégral.

```tsx
interface Props {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Layout :
//   <Header> icon clock + "Avancement" + close button </Header>
//   <Body>
//     <JobIdentity taskId={taskId} />        // J-XXXX · Client + Machine (sans F-num)
//     <SlotContext taskId={taskId}>
//       <VolumeGauge />                       // jauge 100% job, slot isolé
//     </SlotContext>
//     <Question>Quand finirez-vous ?</Question>
//     <QuickActionsRow onSelect={setTime} /> // À l'heure massif + 6 ajustements
//     <CustomTimeStepper time={time} onChange={setTime} />
//     <StatusLine delta={time - plannedEnd} />
//   </Body>
//   <Footer>
//     <CancelBtn onClick={onClose}>Annuler</CancelBtn>
//     <PrimaryBtn onClick={save}>Enregistrer</PrimaryBtn>
//   </Footer>
```

Save handler appelle `useReportSaisieMutation` (RTK Query, optimistic update sur scheduleApi).

### 6.4 VolumeGauge (sub-component clé)

`apps/web/src/components/ProgressCaptureModal/VolumeGauge.tsx`

```tsx
interface Props {
  cumulBeforeSlotPct: number;     // % du job délivré par fragments antérieurs (vient de l'engine)
  slotVolumePct: number;          // % du job que ce créneau délivre (35%)
  expectedAtNowPct: number;       // % du créneau délivré au temps "now" (calculé run-only)
}

// Render structure (cf. playground CSS pm-expect-gauge) :
//   <div class="gauge-track">                              // 100% width
//     <div class="gauge-slot-zone"                          // bande créneau
//          style={{ left: `${cumulBeforeSlotPct}%`,
//                   width: `${slotVolumePct}%` }}>
//       <div class="gauge-slot-fill"                        // fill vert dans la bande
//            style={{ width: `${(expectedAtNowPct / slotVolumePct) * 100}%` }} />
//     </div>
//     <div class="gauge-marker"                             // ligne blanche cumulative
//          style={{ left: `${cumulBeforeSlotPct + expectedAtNowPct}%` }}>
//       <div class="gauge-marker-label">≈ {Math.round(cumulBeforeSlotPct + expectedAtNowPct)}% du job</div>
//     </div>
//   </div>
//   <Endpoints>0% / 100% · fin du job</Endpoints>
//   <SlotInfo>Créneau actif : {slotVolumePct}% du job (de {cumulBeforeSlotPct}% à {cumulBeforeSlotPct + slotVolumePct}%)</SlotInfo>
```

`expectedAtNowPct` calculé côté frontend selon la décomposition calage/roule : `(now - runStart) / (planEnd - runStart) × slotVolumePct`. `cumulBeforeSlotPct` lu depuis `assignment.cumulativePositionPct` (nouveau champ exposé par snapshot).

### 6.5 QuickActionsRow

```tsx
// Layout en T : massive "À l'heure" full-width au-dessus, 6 ajustements compacts en dessous
//   <button class="pm-quick-btn is-ontime" data-min={plannedEndMin}>À l'heure</button>
//   <div class="pm-adjust-row">
//     <button class="pm-quick-btn is-early" data-min={plannedEndMin - 60}>−1h</button>
//     <button class="pm-quick-btn is-early" data-min={plannedEndMin - 30}>−30</button>
//     <button class="pm-quick-btn is-early" data-min={plannedEndMin - 15}>−15</button>
//     <button class="pm-quick-btn is-late"  data-min={plannedEndMin + 15}>+15</button>
//     <button class="pm-quick-btn is-late"  data-min={plannedEndMin + 30}>+30</button>
//     <button class="pm-quick-btn is-late"  data-min={plannedEndMin + 60}>+1h</button>
//   </div>
```

### 6.6 TileContextMenu refactor

`apps/web/src/components/Tile/TileContextMenu.tsx`

Ajouter props :
- `onSaisirAvancement?: () => void` (nouveau)
- `onDefinirDebut?: () => void` (nouveau, ouvre SetStartTimeDialog)

Retirer prop `onToggleComplete` (la complétion est désormais dérivée).

Render conditionnel : un item est rendu *uniquement* si son callback est passé. Chaque vue (planning prod, planning préprod, schedule editor) passe ce qui est pertinent.

### 6.7 SetStartTimeDialog (nouveau)

`apps/web/src/components/SetStartTimeDialog/SetStartTimeDialog.tsx`

Réplique du `sd-overlay` du playground.

```tsx
interface Props {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Sous-composants :
//   <CompactCalendar selectedDay={...} onSelectDay={...} closures={...} />
//   <TimePicker15min time={...} onChange={...} />
//   <FeasibilityPreview targetDateTime={...} />  // appel live à l'endpoint
//   <CancelBtn /> + <PrimaryBtn>Définir</PrimaryBtn>
```

Save handler appelle `usePinAtTimeMutation`. Sur retour avec `slidWith` non-null, afficher un toast warning indiquant le glissement.

### 6.8 useProgressTriggers (hook)

`apps/web/src/hooks/useProgressTriggers.ts`

```tsx
function useProgressTriggers(): Record<TaskId, SaisieState> {
  const { data: snapshot } = useGetSnapshotQuery();
  const now = useNow(60_000); // tick toutes les minutes

  return useMemo(() => {
    if (!snapshot) return {};

    const states: Record<TaskId, SaisieState> = {};
    for (const a of snapshot.assignments) {
      if (a.scheduledStart > now || a.scheduledEnd < now) continue; // pas in-progress

      const lastSaisie = a.lastSaisieAt ? new Date(a.lastSaisieAt) : null;
      const debounced = lastSaisie && (now.getTime() - lastSaisie.getTime() < 30 * 60_000);

      if (a.scheduledEnd <= now && !debounced) {
        states[a.taskId] = 'tile-end';
      } else if (isHourlyTick(now) && !debounced) {
        states[a.taskId] = 'hourly';
      } else {
        states[a.taskId] = 'inactive';
      }
    }
    return states;
  }, [snapshot, now]);
}
```

En mode focus prod : un effet supplémentaire détecte les transitions vers 'hourly' ou 'tile-end' et auto-ouvre `ProgressCaptureModal` pour la tuile concernée.

### 6.9 Auto-completion dérivée

Modifier `apps/web/src/components/Tile/colorUtils.ts` :

```ts
export function computeTileState(
  isShipped: boolean,
  isLate: boolean,
  hasConflict: boolean,
  isBlocked: boolean,
  isCompleted: boolean,
  scheduledEnd: Date,    // nouveau param
  now: Date,             // nouveau param
): TileState {
  const isCompletedEffective = isCompleted || scheduledEnd < now;
  if (isShipped) return 'shipped';
  if (isCompletedEffective) return 'completed';
  // ... reste inchangé
}
```

Audit tous les call sites de `computeTileState` pour passer les nouveaux params. Audit tous les usages directs de `assignment.isCompleted` à des fins d'état pour utiliser la version dérivée.

## 7. Phase 4 — Tests

### 7.1 Backend

- **Rust** : 8+ tests (productivity, feasibility, cumul) — voir Phase 1.4
- **PHPUnit** : 9+ tests (3 endpoints × auth + validation + replan trigger)

### 7.2 Frontend (Vitest)

- `ProgressCaptureModal.test.tsx` — open / save manual / save quick-button / cancel / status updates
- `VolumeGauge.test.tsx` — positions calculées (cumul + slot + marker), dégénérescence (slot=100%, slot=0%)
- `SetStartTimeDialog.test.tsx` — calendar nav / day select / time stepper / feasibility live / save
- `TileContextMenu.test.tsx` — items rendus selon props passées
- `useProgressTriggers.test.tsx` — détection in-progress / debounce 30min / hourly tick / tile-end
- `colorUtils.test.ts` — auto-completion dérivée (existing + scheduledEnd<now case)

### 7.3 E2E (Playwright)

**STRICT** : ne pas lancer Playwright sans permission explicite (rappel CLAUDE.md).

Tests à *écrire* mais pas à lancer sans accord :
- Saisie complète : open icon → modal → "À l'heure" → save → planning re-render
- Pin paramétré : right-click → définir heure → calendar → save → tile shifts
- Auto-trigger tile-end : avancer le temps fictif jusqu'à `scheduledEnd` → vérifier icône amber pulsée

## 8. Phase 5 — Migration

### 8.1 Stratégie

`CompletionToggleIcon` et `SaisieIndicator` ne cohabitent pas (un seul OU l'autre par tuile). Étapes :

1. **Étape A** — Implémenter la chaîne complète sous flag `feature.progressCaptureV2` (off par défaut)
2. **Étape B** — Sandbox testing (vraie DB, vrai engine, vrai operator login — **pas** de fixtures)
3. **Étape C** — Activer le flag pour un sous-ensemble d'opérateurs (1 atelier pilote)
4. **Étape D** — Activer pour tous les opérateurs ; monitorer le manager dashboard pour saisie staleness
5. **Étape E** — Retirer `CompletionToggleIcon` + `prodCompletionApi` + tests obsolètes

### 8.2 Rollback

Désactiver le flag → comportement actuel restauré sans déploiement (juste config).

### 8.3 Modifications DB

- **Nouveau champ** : `Assignment.lastSaisieAt` (nullable timestamp) pour le debounce et la staleness manager-side
- **Nouvelle table optionnelle** : `SaisieAuditLog` (taskId, operatorId, reportedEndTime, reportedAt, reason)
- **Champ exposé snapshot** : `Assignment.cumulativePositionPct` (% du job avant ce fragment) pour la jauge

Migration Doctrine standard. Pas de migration destructive.

## 9. Annexes

### A. Questions ouvertes à arbitrer pendant l'implé

1. **Mode focus prod** — existe-t-il déjà un mode dédié dans l'app, ou faut-il le créer ? Détermine où le auto-open de la modale s'applique.
2. **lastSaisieAt** — champ DB ou dérivé d'audit log ? Champ DB plus rapide à query (debounce, staleness), audit log plus propre architecturalement.
3. **Politique de rétention** pour `SaisieAuditLog` — 90 jours ? Indéfini ?
4. **API d'enrichissement snapshot** — comment exposer `cumulativePositionPct` proprement (champ direct vs. endpoint dédié) ?

### B. Dépendances et ordre d'implémentation

```
Rust engine  ──►  PHP API  ──►  Frontend
   (1, 2, 3)       (saisie,        (composants
                    pin,            connectent
                    feasibility)    aux endpoints)
```

Le frontend ne peut pas être terminé tant que l'engine + PHP n'exposent pas les bonnes signatures. Mais on peut **mocker** côté React pour développer les composants en isolation (les playgrounds servent de référence visuelle).

### C. Estimation grossière

| Phase | Effort estimé |
|---|---|
| 1 — Rust | 2-3 jours |
| 2 — PHP API | 2-3 jours |
| 3 — Frontend | 5-7 jours |
| 4 — Tests | 2-3 jours |
| 5 — Migration sandbox + rollout | 1 jour code + ~1 semaine observation |
| **Total** | **~12-17 jours dev + ~1 sem observation** |

### D. Code de référence — playground

Le playground `playgrounds/tile-prompts-and-menu.html` contient l'implémentation visuelle et logique complète, à reproduire à l'identique côté React :

- Icône saisie (3 états) avec pulse animations
- Tile-level pulses (opacity hourly + orange tile-end)
- Modale d'avancement complète avec layout en T
- **Variante jauge active par défaut** dans la modale (échelle 100% job + slot isolé + marker cumulatif)
- Variante texte conservée comme alternative (toggle dans le simulateur du playground)
- Menu contextuel à 4 items
- Sub-dialog "Définir heure de début" avec calendrier compact + faisabilité live
- Toute la mécanique de calcul calage-aware

### E. Décisions clés en mémoire

Les memories suivantes sont les sources de vérité pour la philosophie de l'implémentation :

- `project_progress_capture_modal.md` — design final v5 modale
- `feedback_auto_replan_no_preview.md` — règle "auto-replan ⇒ pas de UX d'inconsistance"
- `project_calage_run_ratio.md` — décomposition ratio sur runMinutes uniquement
- `project_no_manual_placement.md` — pin/unpin seuls leviers manuels
- `feedback_pin_semantics.md` — slide-to-nearest si infaisable
- `feedback_in_progress_committed.md` — tuile crossing now stays verbatim
