# Plan d'implémentation — Split calage / roule par opérateur

**Date** : 2026-05-02
**Branche** : `setup-vs-run` (créée depuis `implementation-avancement`)
**Mémoires de référence** : `project_setup_run_split_design.md`, `project_engine_gap_semantics.md`

## 1. Vue d'ensemble

Évolution majeure du modèle de compétence opérateur pour permettre :

1. **Proficience asymétrique par phase** — chaque opérateur a une `setupProficiency` et une `runProficiency` distinctes par station. Un opérateur peut être run-only (setupProf=0), versatile, ou calage-only.
2. **Opérateurs distincts pour calage et roule** sur une même tâche, l'engine sélectionnant les paires `(setup_op, run_op)` qui maximisent l'utilisation des roule-only.
3. **Pattern caleur volant** — les opérateurs versatiles servent de caleurs mobiles entre stations, prélevés depuis leur tâche de fond pour caler ailleurs sans invalider le calage de leur plieuse.

L'objectif métier principal est de **maximiser l'utilisation des opérateurs roule-only**, qui ne contribuent que via le run et doivent rester occupés en continu. Le score de l'engine est étendu pour pénaliser leur idle time.

## 2. Architecture cible

```
packages/types (submodule)
  └── src/operator.ts
      └── OperatorSkill : { stationId, setupProficiency, runProficiency }

packages/types (submodule)
  └── src/assignment.ts
      └── TaskAssignment.operators[] : segments avec phase + from + to

services/scheduling-engine
  ├── src/model/
  │   ├── operator.rs    : OperatorSkill { station_id, setup_proficiency, run_proficiency }
  │   ├── job.rs         : (inchangé — setup_minutes / run_minutes déjà séparés)
  │   └── schedule.rs    : nouvel enum GapType, PhaseSegment.gap_reason
  ├── src/productivity.rs : consomme setup_proficiency / run_proficiency selon phase
  └── src/engine/
      ├── forward_pass.rs : pair enumeration, gap typing, preserve_calage flag,
      │                     extension setup_candidates avec emprunts
      └── grid.rs         : (compatible — station_active déjà découplé d'operator_stations)

services/php-api (submodule)
  ├── src/Entity/OperatorSkill.php          : colonnes setup_proficiency + run_proficiency
  ├── src/Migrations/Version20260502*.php    : migration DDL + data
  ├── src/Dto/OperatorResponse.php           : sortie API enrichie
  ├── src/Service/SnapshotBuilder.php        : envoie les 2 valeurs au moteur
  └── src/Controller/ScheduleComputeController.php : buildOperators émet les 2 valeurs

apps/web (regular dir)
  ├── src/components/Operator/SkillsForm.tsx : 2 colonnes (Calage / Roule)
  ├── src/components/Tile/Tile.tsx           : labels opérateur split si différents
  ├── src/components/OperatorSchedule/       : KPI taux d'occupation
  └── src/utils/stationTileData.ts           : extraction segments setup/run depuis operators[]
```

## 3. Phasage et dépendances

```
P1 ── P2 ── P3a ── P3b ── P4
              │      ║
              │      ║
              └─ P0 ─┘
```

- **P1 — Data model split** : prérequis structurel, fournit les 2 valeurs de proficience
- **P2 — Algo respecte split, même opérateur** : consomme P1, l'engine utilise la bonne valeur par phase
- **P3a — Pair enumeration + spécialisation roule-only** : consomme P2, choisit (setup_op, run_op) potentiellement distincts
- **P0 — Refactor moteur (gaps + preserve_calage)** : indépendant, peut être fait en parallèle de P3a, prérequis pour P3b
- **P3b — Emprunts depuis tâche de fond** : consomme P3a + P0
- **P4 — KPI + UI tile + visualisation** : consomme P3a (et améliore avec P3b)

Point d'arrêt observable possible après P3a sans casser l'expérience utilisateur.

## 4. P1 — Data model split setupProf / runProf

**Goal** : Permettre la saisie de proficiences asymétriques par opérateur+station. Engine continue de choisir UN opérateur par tâche.

### 4.1 Migration DB (Doctrine)

Nouvelle migration `Version20260502120000.php` :

```sql
-- up
ALTER TABLE operator_skill ADD setup_proficiency NUMERIC(3,1) NOT NULL DEFAULT 1.0;
ALTER TABLE operator_skill ADD run_proficiency   NUMERIC(3,1) NOT NULL DEFAULT 1.0;
UPDATE operator_skill SET setup_proficiency = proficiency, run_proficiency = proficiency;
-- (drop proficiency lors d'une migration ultérieure après validation prod)

-- down
ALTER TABLE operator_skill DROP COLUMN setup_proficiency;
ALTER TABLE operator_skill DROP COLUMN run_proficiency;
```

### 4.2 Entity PHP `OperatorSkill`

- Ajouter `setupProficiency: float` (défaut 1.0)
- Ajouter `runProficiency: float` (défaut 1.0)
- Garder `proficiency` temporairement (deprecated, lecture-seule consommée par fallback)
- Getters/setters + getters dérivés `getEffectiveSetup()` / `getEffectiveRun()`

### 4.3 OperatorResponse DTO

Champ ajouté `skills: { stationId, setupProficiency, runProficiency }[]`. Le champ legacy `proficiency` peut être conservé un temps (= moyenne) pour rétro-compat des consommateurs FE qui ne sont pas encore migrés.

### 4.4 SnapshotBuilder + ScheduleComputeController

Per mémo `feedback_three_operator_builders` : les 3 sites doivent émettre les nouvelles valeurs. Le plus critique est `ScheduleComputeController::buildOperators` (= ce qui part vers Rust). Les 2 autres (OperatorResponse, SnapshotBuilder) servent l'API et les snapshots.

### 4.5 Types TS partagés

`packages/types/src/operator.ts` :

```typescript
export interface OperatorSkill {
  stationId: string;
  setupProficiency: number;  // [0.0, 2.0], 0 = ne sait pas caler
  runProficiency: number;    // [0.0, 2.0], 0 = ne sait pas rouler
}
```

### 4.6 Rust struct OperatorInput

`services/scheduling-engine/src/model/operator.rs` :

```rust
pub struct OperatorSkill {
    pub station_id: String,
    pub setup_proficiency: f64,
    pub run_proficiency: f64,
}
```

### 4.7 UI form

Page édition compétences opérateur (tableau station × {Calage, Roule}). Validation soft : warning si `setup=0 && run=0` (row inutile, suggérer suppression).

### 4.8 Validation P1

- Migration appliquée sur DB de dev → données existantes dupliquent leur ancienne `proficiency` dans les 2 colonnes
- `composer phpstan` (level 8) et `phpunit` passent
- `cargo build` et `cargo test` passent
- Compute schedule sur scénario test → planning identique à avant migration (proficience symétrique)

## 5. P2 — Algo consomme proficience asymétrique (même opérateur)

**Goal** : L'engine utilise `setupProficiency` pour la durée de calage et `runProficiency` pour la durée de run. Filtre les ops `setupProf=0` / `runProf=0` selon la phase. Toujours UN opérateur par tâche.

### 5.1 productivity.rs

`fragment_realistic_duration` reste fonctionnellement identique (le `ratio_run` lui est passé, peu importe d'où il vient). Le calcul **du** ratio en amont change : il provient désormais de `runProficiency`, pas de `proficiency`.

### 5.2 forward_pass.rs

- `find_operators_for_station(t, station, is_setup_phase)` :
  - si `is_setup_phase=true` : filtrer les ops avec `setup_proficiency(op, station) > 0`, trier desc par `setup_proficiency`
  - sinon : filtrer ops avec `run_proficiency(op, station) > 0`, trier desc par `run_proficiency`
- `operator_productivity(op, t, station, is_setup_phase)` : retourne `setup_proficiency` ou `run_proficiency` selon phase

### 5.3 Validation P2

- Test unitaire : op avec `setupProf=0` exclu des candidats lors de la phase setup
- Test unitaire : op avec `runProf=0` exclu des candidats lors de la phase run
- Test scénario : Bernard `setupProf=2, runProf=1.5` cale 2× plus vite et roule 1.5× plus vite que la base
- Compute schedule sur scénario réel : op avec `setupProf=0` jamais vu en setup, présent en run

## 6. P0 — Refactor moteur : typage des gaps + preserve_calage

**Goal** : Permettre une absence opérateur planifiée sans invalider le calage. Fondation pour P3b.

### 6.1 model/schedule.rs

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GapType {
    Closure,
    OperatorAbsentManaged,    // emprunt / pause planifiée
    OperatorAbsentUnmanaged,  // absence non planifiée
    RecalageForced,           // péremption a déclenché un recalage
}

pub struct PhaseSegment {
    pub start: String,
    pub end: String,
    pub gap_reason: Option<GapType>,  // None = segment actif (pas un gap)
}
```

### 6.2 Action struct (forward_pass.rs)

Ajouter :

```rust
pub preserve_calage_during_gap: bool,  // default false
```

Default false : comportement strictement identique à aujourd'hui pour toutes les actions actuelles.

### 6.3 apply_peremption_rule

Quand `preserve_calage_during_gap=true` ET la cause du tick idle est `OperatorAbsentManaged`, ne **pas** incrémenter `idle_ticks`. Concrètement : reset `idle_ticks=0` à chaque retour d'opérateur qualifié pendant que le flag est levé.

### 6.4 derive_active_windows_from_log

Étiqueter chaque PhaseSegment retourné avec son `gap_reason` (calculé à partir de la cause du tick précédent dans le log).

### 6.5 Validation P0

- Tous les tests existants passent verbatim (default false → comportement inchangé)
- Nouveau test : Action avec `preserve_calage_during_gap=true` + 200 min sans op → péremption non déclenchée
- Test : gap typé `Closure` → péremption déclenchée comme avant

## 7. P3a — Pair enumeration + spécialisation roule-only

**Goal** : Au tick `t`, énumérer les paires `(setup_op, run_op)` viables, scorer, choisir la meilleure. La règle "préférer roule-only en run" émerge naturellement via tiebreaker.

### 7.1 Algo de placement modifié

Pseudocode dans `assign_action_at_tick` (et fonctions appelantes) :

```
setup_candidates = find_operators_for_station(t, S, is_setup_phase=true)
for setup_op in setup_candidates:
    setup_end = t + setup_ticks(setup_op, S)
    run_candidates = find_operators_for_station_earliest(setup_end, S, is_setup_phase=false)
    for (run_op, t_r) in run_candidates:
        scored_pair = score_placement(setup_op, run_op, t, setup_end, t_r)
        track best
return best
```

### 7.2 Score étendu

Tuple : `(unplaced, late_jobs, lateness, run_only_idle, makespan)`. Un nouveau terme `run_only_idle` calcule l'inactivité de l'horizon des opérateurs avec `setupProf=0` sur toutes leurs stations qualifiées.

Tiebreaker à makespan égal :
1. gap minimal (`t_r - setup_end`) — préférer placements compacts
2. `run_op` avec `setupProf(run_op, S) = 0` — préférer un roule-only pour le run (libère les versatiles pour les calages)
3. ID lexicographique pour déterminisme

### 7.3 Sortie : segments distincts

`ComputedAssignment.operators[]` reçoit deux entrées même si `setup_op == run_op` :

```
operators = [
    { operator_id: setup_op, phase: "setup", from: t,      to: setup_end },
    { operator_id: run_op,   phase: "run",   from: t_r,    to: run_end   },
]
```

Cohérent avec le data model assignment.

### 7.4 Validation P3a

- Test scénario : Frédéric `setupProf=0, runProf=1` + Bernard `setupProf=2, runProf=1.5` partagent une plieuse → Bernard cale, Frédéric roule
- Test : si pas de roule-only dispo, Bernard fait setup ET run (même op fallback)
- KPI run_only_idle mesurable sur scénario réel (avant: tous identiques, après: contraste ops roule-only vs versatiles)

## 8. P3b — Emprunts depuis tâche de fond

**Goal** : Setup_candidates étendus aux ops actuellement en run sur une autre tâche, pour permettre des emprunts caleur volant. La plieuse de fond reste calée pendant les emprunts (preserve_calage_during_gap=true).

### 8.1 Étendre find_operators_for_station (setup phase)

```
setup_candidates(t, S) =
  A. ops idle au tick t avec setupProf > 0           (cas classique)
  ∪
  B. ops actuellement en run d'une tâche X ailleurs avec setupProf(op, S) > 0
     ET le chunk de calage en cours sur X reste ≥ chunk_mini après l'emprunt
     ET preserve_calage_during_gap activable sur X
```

### 8.2 Activation de preserve_calage sur la tâche de fond

Quand un op est emprunté depuis sa tâche X :
- L'Action de X reçoit `preserve_calage_during_gap = true` pour la durée de l'emprunt
- Les ticks d'absence de l'op sont taggés `OperatorAbsentManaged`
- À son retour, le calage est intact (péremption non déclenchée)

### 8.3 Score impact

Score additionnel pour l'emprunt :
- coût : `scheduledEnd` de X repoussé de `setup_ticks(S)`
- bénéfice : `run_only_idle` réduit (le run-only sur S n'attend pas)

L'algo arbitre automatiquement.

### 8.4 Limite chunks par tâche de fond

Pas de cap dur, mais terme de score qui décroît au-delà de N chunks (N=3 par défaut, ajustable). Évite la fragmentation excessive et illisible.

### 8.5 Validation P3b

- Test scénario : Bernard rolling X sur plieuse A, plieuse B a besoin d'un calage urgent → Bernard prélevé, X paused, calage B fait, Bernard retour sur X
- Test : péremption non déclenchée pendant l'emprunt (vs P0 fonctionne)
- Test : si l'emprunt force chunk_mini violation sur la tâche de fond, candidat exclu

## 9. P4 — KPI utilisation + UI tile multi-segment

**Goal** : Rendre visible l'objectif "occuper les roule-only" et représenter les pauses/relèves sur les tiles.

### 9.1 KPI vue opérateur

- Taux d'occupation par opérateur sur l'horizon (présent à au moins une station / total ouvré)
- Décompte calages par opérateur versatile
- Vue tableau ou cartes : "Alice 92 % occupée, Frédéric 88 %, Bernard (caleur) 4 calages 76 %"

### 9.2 Tile multi-segment

Sur les tiles où `operators[]` contient des segments distincts setup vs run :
- Si `setup_op == run_op` → label compact (1 nom)
- Sinon → label "B./F." avec popover détail
- Conserver la zone visuelle calage (déjà rendu via `setup_end`)

### 9.3 Vue station — pauses visibles

Quand `active_windows` contient des gap_reasons `OperatorAbsentManaged` → rendre la zone hachurée ou opacité 40 %, hover : "En attente du retour de Bernard (caleur)".

### 9.4 Validation P4

- Playground HTML d'abord (per mémo `playground_before_fe`) pour valider la représentation
- Snapshot tests sur tile multi-segment
- KPI sur scénario réel : run_only_idle visible et réduit sur scénarios où l'algo P3a/P3b a optimisé

## 10. Stratégie de commit

Chaque phase se finit par un ou deux commits logiques. Les submodules sont commités d'abord, puis leurs références bumped dans le monorepo.

```
P1 :
  - commit packages/types (interface)
  - commit services/php-api (entity + migration + 3 builders)
  - commit monorepo (bump submodules + Rust struct + UI form)

P2 :
  - commit monorepo (forward_pass.rs + productivity.rs)

P0 :
  - commit monorepo (model/schedule.rs + forward_pass.rs)

P3a :
  - commit monorepo (forward_pass.rs pair enum + score)

P3b :
  - commit monorepo (forward_pass.rs setup_candidates extension)

P4 :
  - commit packages/types (segments enrichis)
  - commit monorepo (UI tile + KPI views)
```

## 11. Hors-scope explicite

Ne PAS faire dans cette session :
- Drop de la colonne `proficiency` legacy (à faire dans une migration ultérieure quand tous les consommateurs ont migré)
- Pin des opérateurs (le pin reste sur le créneau, jamais sur l'opérateur — mémo `pin_semantics`)
- Modifier le mécanisme masked time (concurrent groups) — il continue de fonctionner pour le run, transparent au split
- Min/max_setup_attention (calage insensible à l'effectif au-delà du minimum, mémo design)
- `run_min_minutes` séparé (chunk_mini déjà en place gère le minimum acceptable)
