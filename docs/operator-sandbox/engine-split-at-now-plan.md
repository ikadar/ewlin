# D — Engine split-at-NOW (Q1 raffinée)

> **Statut** : planning, non implémenté. Ce doc cadre le chantier pour une session Rust dédiée. La décision Q1 est verrouillée 2026-05-04 dans `feedback_in_progress_committed.md`.

## Décision

**Le passé pré-NOW reste verbatim. La portion post-NOW de la tuile en cours devient mutable, sous réserve du chunk-mini policy basé sur le temps task-elapsed.**

Cf. `feedback_in_progress_committed.md` (mémoire) — supersedes 2026-04-28 "tile crossing now stays verbatim end-to-end".

## Pourquoi ce chantier mérite une session dédiée

Quatre contraintes :
1. **5+ tests Rust verrouillés** (`forward_pass.rs:4969`, `:5008`, `:5111`+) attestent la règle actuelle. Tous doivent être réécrits ou supprimés.
2. **`pre_place_pinned_actions` à 280 lignes** (`forward_pass.rs:2676-2960`) traite 7 cas de pin distincts (user, safety-zone-frozen, in-progress, etc.). Le split-at-NOW ajoute un cas hybride.
3. **Risque de régression scoring** : la chunk-mini policy interagit avec péremption, BAT floor, earliest-start. Une mauvaise comptabilisation `task_elapsed` casse le scoring tuple `(unplaced, late, lateness, makespan)`.
4. **PHP `ScheduleComputeController.buildJobs`** doit emit la portion past + future séparément — modification du protocol Rust ↔ PHP.

## Algo proposé

### Côté PHP (`ScheduleComputeController.buildJobs`)

Pour une assignment in-progress (`startTs < now < endTs && !isCompleted`) :

```
- Sortir UN action :
  pinned_start_tick = original_start_tick (préservé)
  pinned_end_tick   = ABSENT (la fin est libre)
  is_pinned         = true (passé verrouillé)
  is_in_progress    = true (NEW flag)
  task_elapsed_ticks = now_tick - original_start_tick (NEW flag)
```

Le flag `is_in_progress` informe l'engine que cette pin a une **fin libre**. Le flag `task_elapsed_ticks` lui dit combien de temps a déjà été consommé (pour la chunk-mini policy).

### Côté Rust (`pre_place_pinned_actions`)

Modification du bloc `is_in_progress_pin` (`forward_pass.rs:2807`) :

```rust
let is_in_progress_pin = actions[i].is_in_progress;
if is_in_progress_pin {
    // Past portion stays at pinned_start_tick. Future portion enters
    // the scoring loop with `eat = task_elapsed_ticks` already counted.
    actions[i].is_pinned = false;            // Free the end_tick.
    actions[i].pinned_end_tick = None;       // Engine picks the end.
    actions[i].forced_start_tick = Some(actions[i].pinned_start_tick.unwrap());
    actions[i].already_eaten_ticks = task_elapsed_ticks;
    // Exempt from chunk-mini guard (task-elapsed accounting compensates).
    continue;
}
```

Le concept `forced_start_tick` (NEW) force la position de départ — l'engine ne déplace pas le début. Le concept `already_eaten_ticks` (NEW) informe le scoring loop que `eat` part de cette valeur, pas de 0.

### Côté Rust (chunk-mini guard)

Au lieu de `eat == 0`, vérifier `eat - already_eaten_ticks >= chunk_mini_ticks` quand on évalue l'interruption :

```rust
let effective_eat = eat.saturating_sub(already_eaten_ticks);
if effective_eat < chunk_mini_ticks {
    // Stop here would violate chunk-mini even with task-elapsed credit.
}
```

## Fichiers à toucher

| Fichier | Modification |
|---|---|
| `services/scheduling-engine/src/model/job.rs` | Ajouter `is_in_progress: bool`, `task_elapsed_ticks: u32`, `forced_start_tick: Option<u32>`, `already_eaten_ticks: u32` à `TaskInput` et `TaskAction`. Init défaut = false/0/None. |
| `services/scheduling-engine/src/engine/forward_pass.rs` | `pre_place_pinned_actions:2807` — remplacer l'exemption par split-at-NOW. Chunk-mini guard à `:2818-2870` — utiliser `effective_eat`. |
| `services/scheduling-engine/src/engine/forward_pass.rs` (tests) | Réécrire `in_progress_safety_zone_pin_skips_chunk_mini_guard` (4969), `in_progress_pin_with_short_remaining_window_still_kept` (5008), `in_progress_pin_below_earliest_start_is_kept` (5111) en attestant la nouvelle règle. |
| `services/php-api/src/Controller/ScheduleComputeController.php` | `buildJobs` — flagger `isInProgress` + emit `taskElapsedTicks` sur les assignments past-current. |
| `services/php-api/src/Controller/ScheduleComputeController.php` (tests) | Couverture d'un cas in-progress avec assertion sur les nouveaux flags. |
| `feedback_in_progress_committed.md` (mémoire) | Mettre à jour pour refléter l'implémentation effective. |

## Tests à ajouter (au-delà des updates des 3 existants)

1. **`in_progress_pin_split_at_now_chunk_mini_with_credit`** : pin in-progress avec `task_elapsed_ticks=8`, chunk_mini=10. Vérifier que l'engine peut interrompre dès `effective_eat >= 2` (10 - 8).
2. **`in_progress_pin_resched_to_different_station`** : Q1 stipule "l'algo peut interrompre la task en cours sur une machine donnée". Vérifier qu'au prochain replan, le post-NOW peut être placé sur une station différente.
3. **`in_progress_pin_past_portion_immutable`** : tenter de modifier `pinned_start_tick` doit être ignoré ; le passé reste verbatim.

## Pré-requis

- Doc lu : `feedback_in_progress_committed.md`, `feedback_chunk_mini_resume.md`, `feedback_chunk_mini_peremption_bypass.md`, `feedback_chunk_mini_window_zero.md`, `project_pre_place_pinned_is_sole_capacity_guard.md`
- Stack Rust opérationnel (cargo run + cargo test)
- ~15 tests forward_pass.rs verts en baseline avant de commencer

## Estimation

- ~6h focus Rust (avec tests + debug + cargo verts)
- ~2h PHP (controller + couverture)
- ~1h memory + doc updates

Total : **~1 jour focus**. Pas adapté à un session multi-tâches.

## Pourquoi NOT bundler avec le reste du plan-and-replan

La mindmap "Plan and replan" a 14/15 livraisons FE + storage + PHP write paths cumulées au 2026-05-05. Le 15e item (D) est le seul qui touche au cœur scoring engine Rust. Les régressions sur le scoring sont coûteuses à débuguer (toute la planification est impactée). Une session dédiée focus engine donne le bandwidth nécessaire pour itérer sur les 15+ tests de forward_pass sans pression d'autres livraisons.
