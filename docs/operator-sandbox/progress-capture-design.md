# Progress Capture & Auto-Completion — Design Document

**Date** : 2026-05-01
**Status** : Design phase, implementation pending
**Scope** : Operator progress reporting flow in Flux focus prod mode

## 1. Context

Operators in production need a way to report progress on their tasks. The current implementation uses a binary checkbox (`CompletionToggleIcon`) on each tile. Limitations :

- Only conveys binary state (done / not done)
- No partial progress signal
- Doesn't propagate productivity information to the planning algorithm
- Doesn't allow the operator to express "I'll finish later than planned"
- Currently appears non-functional in prod (separate concern, to be investigated)

We need a richer model that :

- Captures continuous progress signal
- Drives auto-replan with operator's actual pace
- Distinguishes setup (calage) from run (roule) for accurate propagation
- Stays minimal in operator UI (atelier ergonomics : hands occupied, screens glanced, gestures fast)

## 2. The minimal saisie modal (v5)

The operator's progress report is reduced to a **single question** :

> **À quelle heure pensez-vous terminer ?**

The modal contains :

| Element | Detail |
|---|---|
| Header | Icône horloge blanche + titre `Avancement` |
| Job identity | `J-XXXX · Client` + machine |
| Slot context | Cadre neutre `bg-white/[0.03]` : « Entre HHhMM et HHhMM, nous attendons de vous que vous ayez traité X% du volume de cet élément. » |
| Question | « À quelle heure pensez-vous terminer ? » (vouvoiement) |
| Time input | Largeur 7.5rem, font 18px, focus border bleu |
| Stepper buttons | ±15 min de chaque côté du champ |
| Shortcut | Bouton **À l'heure** (vert emerald, raccourci pour le cas dominant) |
| Status line | `Vous finirez à l'heure prévue.` / `+X min en avance` (emerald) / `+X min en retard` (amber) |
| Footer | Annuler (zinc) + **Enregistrer** (bleu, `bg-blue-600`) |

Reference implementation : `playgrounds/tile-progress-modal.html`.

### Design principles

- **Vouvoiement intégral** — distance professionnelle, lisible aussi par un manager
- **3-pole color palette** — bleu = action validation, vert = état positif, amber = retard non-bloquant
- **Single signal** — l'opérateur communique un moment cible (heure de fin), pas une quantité ou un %. Le moteur reconstitue le reste (productivité, % volume, propagation).
- **Pas de slider, pas de cascade textuelle, pas de sync bidirectionnelle** — éliminés en cours de 5 itérations comme redondants ou mensongers
- **Tokens Flux respectés** (`flux-elevated`, `flux-border`, `flux-text-*`)

## 3. Auto-replan as UX simplifier

Each `Enregistrer` triggers a complete replan (3–5 secondes, modale de progression existante gère la latence). Cette propriété architecturale **élimine une classe entière de UX** qu'on aurait sinon dû concevoir :

| Pattern devenu inutile | Pourquoi |
|---|---|
| Preview / diff avant save | Plan = state après commit |
| Mode brouillon | Pas d'état tentatif ; la saisie est un fait |
| Résolution de conflit accept/reject | L'algo absorbe et résout |
| Queue d'opérations | Une saisie = un événement d'absorption |
| Gestion de divergence d'état | Le serveur est source de vérité post-replan |

**Conséquence pour la tuile** : aucune visualisation enrichie n'est nécessaire (fill colorisé, trait théorique, couleur de statut). La géométrie de la tuile elle-même reflète l'état courant après replan. La NOW line standard de l'app suffit comme repère temporel.

> **Règle générale** : tout enrobage UX qui prétend visualiser un *écart au plan* dans un système à auto-replan ment, parce que le gap est mathématiquement nul après chaque save.

## 4. Modèle de durée — théorique vs réaliste, à 3 niveaux

Pour soutenir l'auto-replan continu, le système maintient **deux durées en parallèle** à trois niveaux du modèle (fragment, task, job). Cette dualité est l'invariant qui permet de tout reconstituer après chaque saisie.

| Niveau | Durée théorique (immutable) | Durée réaliste (calculée, vivante) |
|---|---|---|
| **Fragment** | `setupMinutes + runMinutes` du JCF | `setupMinutes + runMinutes × ratio_run` (cf. § 5) |
| **Task** (avant fragmentation) | Somme des durées théoriques des fragments | Somme des durées réalistes des fragments |
| **Job** | Somme des tasks théoriques | Somme des tasks réalistes |

### Règle d'affichage

> **On utilise toujours la durée *réaliste* pour piloter et afficher**, sauf cas explicite où la durée théorique est demandée (audit, comparaison post-mortem, devis).

L'opérateur, le chef d'atelier et l'algo voient la durée réaliste. La théorique reste consultable mais n'est pas l'information dominante. À l'initialisation d'une task (avant toute saisie), réaliste = théorique — donc aucun changement visible.

### Pourquoi cette dualité

1. **Traçabilité** : on garde toujours la trace du contrat initial (JCF) pour audit, devis, comparaison post-mortem (« on avait estimé X, on a fait Y »).
2. **Stabilité** : la théorique ne bouge jamais ; les ratios qui s'accumulent au fil des saisies n'érodent pas le contrat d'origine.
3. **Reconstitution** : à n'importe quel instant, on peut recalculer la réaliste depuis la théorique + l'historique des ratios — donc dégradation gracieuse en cas de divergence DB ou bug d'écriture.

### Implications data model

Chaque entité (Fragment / Task / Job) doit exposer **deux champs durée** :

```
Fragment.theoreticalDurationMinutes  : u32  // immutable, vient du JCF
Fragment.realisticDurationMinutes    : u32  // calculé : setupMin + runMin × ratio_run

Task.theoreticalDurationMinutes      : u32  // = Σ fragment.theoretical
Task.realisticDurationMinutes        : u32  // = Σ fragment.realistic — recalculé à chaque replan

Job.theoreticalDurationMinutes       : u32  // = Σ task.theoretical
Job.realisticDurationMinutes         : u32  // = Σ task.realistic — recalculé à chaque replan
```

Les deux niveaux supérieurs (Task, Job) sont dérivés des fragments — pas besoin de les stocker en DB s'ils sont calculés à la volée à chaque snapshot. Stocker uniquement si la perf l'exige.

### Implications UI

- **Tile tooltip** : afficher la durée réaliste en avant, théorique discrète si l'écart est notable
- **JDP** : task summary avec durée réaliste dominante, théorique en sous-info ou tooltip
- **Modale d'avancement** : déjà conforme — la jauge montre le volume (donc indirectement la productivité réelle), la slot range affiche les heures planifiées (donc la réaliste courante)
- **Job summary (admin)** : les deux durées affichées côte à côte, avec delta visible en pourcentage

## 5. Calage vs. roule — décomposition du ratio de productivité

Le ratio de productivité s'applique au **roule uniquement**, pas au calage. Le calage est borné par la machine et la matière (durée fixe ou faiblement variable) ; le roule est borné par l'opérateur (durée élastique).

### Calcul

```
elapsed    = now − scheduledStart
new_run    = (new_end − scheduledStart) − task.duration.setupMinutes
ratio_run  = new_run / task.duration.runMinutes
```

Propagation aux fragments suivants du même job :

```
fragment.new_duration = fragment.duration.setupMinutes
                      + fragment.duration.runMinutes × ratio_run
```

### Inférence de phase

Le moteur infère la phase courante de l'opérateur :

- `now < scheduledStart + setupMinutes` → **calage** (saisie rare, on présume calage à l'heure, delta entièrement attribué au run à venir)
- Sinon → **roule** (cas usuel)

### Pas d'EWMA

Chaque saisie produit un nouveau ratio à partir de l'observation courante. **Les ratios passés ne se composent pas** dans une moyenne glissante. Raison : F2 et F3 peuvent avoir des conditions très différentes (opérateurs, machines, complexité), une moyenne mélangerait des signaux non comparables.

### Edge cases

- `new_run < run_elapsed` → clamp à `run_elapsed`, log « saisie incohérente »
- `setupMinutes = 0` → `ratio_run` dégénère vers `ratio_total` (pas de cas spécial à coder)
- Calage long + roule court (haut de gamme petit tirage) : la décomposition est critique pour ne pas propager du retard fantôme sur des phases qui ne le subissent pas

## 6. Auto-completion (« no news = good news »)

Pour les tuiles où `scheduledEnd < now` et sans saisie contradictoire :

- **Statut inféré** : terminée à `scheduledEnd` selon le dernier plan en vigueur
- **Justification logique** : la case à cocher de complétion étant retirée en mode prod (décision JDP), sans signal explicite ni saisie contradictoire, l'unique interprétation cohérente est « terminée à l'heure prévue ». C'est la **conclusion forcée** par les choix de design, pas une option parmi d'autres.
- **Implementation** : dérivée, pas mutée
  ```ts
  const isCompletedEffective =
    assignment.isCompleted || new Date(assignment.scheduledEnd) < now;
  ```
- **Avantages de la dérivation sur l'écriture** :
  - Pas besoin d'un job de batch qui « avance » l'heure et flippe les flags
  - Self-healing : si le replan déplace `scheduledEnd` en arrière de `now`, la tuile redevient en cours automatiquement
  - Pas de race condition entre l'écriture du flag et le replan
- **Trade-off accepté** : les tuiles silencieusement débordées (l'opérateur a fini en retard mais n'a rien dit) sont marquées terminées-à-l'heure. Perte de fidélité acceptée pour avoir un système qui ne se bloque jamais en attente d'un signal manuel.

### Précision sur « comme prévu »

Le « comme prévu » réfère **au dernier plan en vigueur**, pas au plan d'origine. Si l'opérateur a fait une saisie « +30 min » à 11h00, puis ne re-saisit plus, la tuile auto-complète à `scheduledEnd_post_saisie` (12h30) — pas à l'heure planifiée d'origine. C'est cohérent avec « plan = vérité après commit ».

### Correction rétroactive

L'opérateur peut ouvrir une tuile auto-complétée et faire une saisie avec une heure de fin dans le passé (ex. « non en fait j'ai fini à 14h, pas à 12h30 »). Le replan absorbe ce delta rétroactif et propage les conséquences à l'aval (jobs impactés, statistiques mises à jour). La modale telle que définie le permet déjà — l'heure de fin saisie peut être dans le passé sans difficulté.

## 7. Interaction opérateur

### Trois chemins d'ouverture de la modale

La modale peut être déclenchée de trois façons :

| Chemin | Quand | Caractère |
|---|---|---|
| **Manuel** — click sur l'icône progrès de la tuile | À tout moment, à l'initiative de l'opérateur | Geste explicite |
| **Automatique tile-end** | Quand `scheduledEnd` est atteint sur l'horloge | Non-bloquant, dismissable |
| **Automatique hourly** | Toutes les heures pendant qu'une tuile est in-progress | Non-bloquant, dismissable, debounce 30 min |

Détails sur les triggers automatiques en section 8.

### Manuel : substitution de l'icône checkbox

**Substitution minimale** : on remplace l'icône `CompletionToggleIcon` sur la tuile par une nouvelle icône « progrès » (jauge / chart) au même emplacement. Click sur l'icône → ouvre la modale. Les autres interactions de la tuile sont conservées :

| Gesture | Action |
|---|---|
| Click sur le corps de la tuile | Sélectionne le job (existing, pour JDP) |
| Click sur l'icône progrès | **Ouvre la modale de saisie (nouveau)** |
| Double-click | Tooltip + crosslink (existing) |
| Right-click | Menu contextuel (existing, refondé — voir plus bas) |

En mode focus prod ultérieurement, on pourra élargir « click anywhere sur la tuile active → ouvre la modale » si l'usage le demande.

### Menu contextuel refondé (clic droit en prod)

Le `TileContextMenu` actuel a 6 items dont la majorité ne fait pas sens en mode prod (algo-driven, ou redondants avec le nouveau modèle). Le menu prod réduit à 4 items :

| Item | Action |
|---|---|
| Voir détails | Ouvre le JobDetailsPanel (existing) |
| Saisir l'avancement | Ouvre la modale d'avancement (nouveau, équivalent au click sur l'icône) |
| Épingler / Désépingler | Toggle pin au `scheduledStart` courant (existing) |
| **Définir heure de début…** | **Nouveau** — ouvre un sub-dialog jour/heure, puis crée un pin paramétré à cet instant |

**Mécanique de « Définir heure de début… »** :
- Sub-dialog avec sélecteur jour (calendrier compact) + heure (granularité 15 min)
- Aperçu de faisabilité dans le sub-dialog (« créneau dispo » vs. « sera glissé à HH:MM le jour suivant »)
- Boutons : `Annuler` + `Définir` (bleu, primaire système)
- Si le créneau est dispo → pin direct à cet instant
- Si infaisable (fermeture, capacité, dépendance non résolue) → slide au prochain créneau dispo + warning modale (comportement Pin existant verbatim)
- Si la tuile était déjà pinnée → le pin se déplace ; pas de cascade unpin / re-pin

**Cohérence avec les invariants** :
- `Pin = créneau, pas opérateur` (memory existante) — la mécanique slide-to-nearest est partagée
- `No manual tile placement` — l'item ne place pas la tuile manuellement, il crée un pin paramétré que l'algo résout

**Items retirés du menu prod** :
- `Marquer terminé / non terminé` — la complétion devient dérivée (`scheduledEnd < now`), il n'y a plus de flag à toggler
- `Rappeler (désassigner)` — opération admin/réordonnancement, pas du registre opérateur
- `Diviser` / `Fusionner` — la fragmentation est désormais algo-driven (`chunk-mini`)

**Items conservés ailleurs** : le menu admin/préprod peut continuer à exposer Rappeler / Diviser / Fusionner. `TileContextMenu` les expose déjà comme props optionnelles ; chaque vue ne passe que ce qui lui est pertinent.

### Flux de save

1. Opérateur clique sur l'icône progrès de la tuile
2. Modale s'ouvre, préremplie avec `scheduledEnd` actuel
3. Opérateur ajuste (ou clique **À l'heure** pour le cas inchangé)
4. Click **Enregistrer**
5. Modale se ferme
6. Modale de progression replan existante apparaît (3–5 s)
7. Nouveau planning rendu

## 8. Stratégie de prompts actifs (validée)

Pour neutraliser le risque de retard silencieux sans tomber dans le forçage, deux triggers automatiques pour ouvrir la modale :

### Trigger 1 — Tile-end (à `scheduledEnd`)

Au moment exact où l'horloge atteint `scheduledEnd` d'une tuile in-progress, on ouvre la modale automatiquement. Ce moment correspond exactement à celui où l'auto-completion silencieuse aurait sinon enclenché — le prompt convertit l'inférence muette en confirmation explicite. L'opérateur peut :

- Cliquer **À l'heure** → tuile officiellement complétée à `scheduledEnd` (donnée propre)
- Saisir **+X min** ou **−X min** → tuile complétée à l'heure ajustée, replan déclenché (donnée propre)
- **Dismiss / ignorer** → fallback sur l'auto-completion silencieuse (« no news = good news » conservé en filet de sécurité)

Le résultat : la donnée présumée devient l'exception, pas la règle.

### Trigger 2 — Hourly pendant in-progress

Pendant qu'une tuile est in-progress, on prompte l'opérateur **toutes les heures** pour confirmer ou ajuster son estimation de fin. Cadence atelier réaliste — sur un quart de 8h avec 4 tâches d'1-2h chacune, l'opérateur reçoit 8-10 prompts au total, avec un espacement moyen > 1h. Compatible avec la concentration physique.

### Modulation contextuelle — planning view vs. focus mode

Les deux triggers se manifestent **différemment** selon le mode d'affichage courant :

| Trigger | Planning view (toutes tuiles visibles) | Focus prod mode (une tuile dominante) |
|---|---|---|
| **Hourly** | Icône bleue + pulse opacité sur la tuile (cycle 1,6 s, sans changement de couleur), click pour ouvrir | **Modale auto-ouverte** (dismissable) |
| **Tile-end** | Icône amber pulsée + pulse de la tuile vers/depuis l'orange (cycle 1,6 s), click pour ouvrir | **Modale auto-ouverte** (dismissable, plus visible) |

**Pourquoi cette différence** : en planning view, l'opérateur peut être en train de regarder d'autres tuiles ou un autre élément ; un signal subtil (indicateur + pulse) respecte ce contexte. En focus mode, la tuile EST le contexte — auto-ouvrir la modale, c'est suivre la logique du mode plutôt que la contrarier.

**Règle d'attention pour les pulses de tuile en planning view** :
- **Hourly** = pulse en *opacité pure* (pas de couleur), cycle 1,6 s. Le signal est présent dans le champ visuel sans mobiliser un code couleur — typique d'un rappel récurrent qu'on ne veut pas voir saturer la palette.
- **Tile-end** = pulse *vers et depuis l'orange*, cycle 1,6 s synchronisé avec l'icône amber. L'orange est réservé à cet état (distinct de default/completed/late/conflict/blocked) ; c'est la couleur du « moment de saisie ».
- **Cohérence rythmique** : les deux pulses partagent le même tempo (1,6 s) ; la différenciation passe uniquement par la présence ou non de couleur. Tempo identique = pas de hiérarchie sonore-visuelle parasite, ce qui reste lisible si plusieurs tuiles pulsent dans le même viewport.

### Caractéristiques communes des prompts actifs

| Aspect | Règle |
|---|---|
| Caractère | **Non-bloquant** — la modale s'ouvre mais peut être ignorée |
| Flash / bip | **Non.** Apparition douce. Pas d'attaque sensorielle. |
| Dismiss | Échap ou click hors modale = annule, **pas de pénalité** côté algo |
| Debounce | Pas de prompt automatique si une saisie a été faite dans les 30 dernières min |
| Tile-end systématique | Le prompt à `scheduledEnd` se déclenche **toujours**, même si une saisie récente a eu lieu — ce moment est trop précieux pour être sauté |
| Multi-tuile parallèle | Si plusieurs tuiles in-progress (masked time), un seul prompt à la fois, le reste en file d'attente |
| Fallback auto-completion | Si l'opérateur dismiss ou ignore le prompt, le modèle silencieux « no news = good news » prend le relais |
| Focus mode auto-open | La modale peut être plus compacte / décalée, pas de dim agressif du fond — la tuile derrière reste visible pour le contexte |

### Pourquoi ces deux triggers et pas d'autres

- **Le tile-end est le moment-clef** : l'opérateur transite naturellement entre deux tâches, il a déjà la tête au système. Friction marginale = quasi-zéro.
- **Le hourly est le compromis raisonnable** entre fraîcheur de donnée algo et respect du geste atelier. Le 15-min testé en début de design était trop fin (cf. annexe historique ci-dessous).
- **Pas de trigger basé sur événements algo** dans cette V1 (ex. anomalie détectée, deadline imminente). Pourra être ajouté en V2 si besoin sans casser la stratégie.

### Effet attendu sur la qualité de donnée

- **Avant** : `auto-completion silencieuse` est la règle ; les retards silencieux passent inaperçus, l'algo travaille sur des présomptions optimistes.
- **Après** : `confirmation explicite à `scheduledEnd`` + `mises à jour intermédiaires hourly`. La présomption optimiste devient un filet de sécurité (dismiss), pas le mode dominant.

### Note historique

Une variante forçante (15 min + flash rouge + bip) a été envisagée et rejetée. Raisons : UX atelier hostile (mains occupées, focus à préserver), risque de dismiss en masse dégradant la donnée vers du bruit, charge compute replan déraisonnable, impact négatif sur la confiance opérateur. La règle de design correspondante : **aucune UX bloquante ou forçante en mode prod**, sauf urgence sécurité (incident machine, fin de poste).

## 9. Hors scope

- Sync bidirectionnelle temps / volume dans la modale (rejeté — l'opérateur pense en temps)
- Visualisation cascade sur les tuiles voisines (rejeté — replan gère)
- Saisie spécifique calage (différé — l'inférence de phase implicite suffit)
- Notes / commentaires opérateur lors de la saisie (différé — canal séparé)
- Visualisation temps réel de la propagation (rejeté — replan absorbe)

## 10. Plan d'implémentation

### Composants

- **Nouveau** : `apps/web/src/components/ProgressCaptureModal.tsx` — miroir de `playgrounds/tile-progress-modal.html`
- **Modifié** : `apps/web/src/components/Tile/Tile.tsx` — remplacement de l'invocation `CompletionToggleIcon` par le déclencheur de la nouvelle modale
- **À retirer** (après que la nouvelle modale ait atterri) : `apps/web/src/components/Tile/CompletionToggleIcon.tsx`

### API

- Nouveau endpoint requis : `POST /api/v1/scenarios/prod/saisie/{taskId}` (nom à valider) acceptant `{ estimatedEndTime: ISO8601 }`
- Le backend dispatch au moteur pour replan, retourne le snapshot mis à jour
- Mirror du pattern `prodCompletionApi` pour update optimiste + invalidation cross-API

### Changements moteur

- Fonction de calcul du ratio de productivité : lit `task.duration.setupMinutes`, applique le ratio à `runMinutes` uniquement
- Propagation aux fragments suivants du même job
- Edge case : `new_run < run_elapsed` clamp + log

### Dérivation auto-completion

- Dans `computeTileState()` : `isCompletedEffective = isCompleted || scheduledEnd < now`
- Tous les call sites qui lisent `isCompleted` à des fins d'état doivent utiliser la forme dérivée

## 11. Décisions clés en mémoire

Pour référence rapide, les décisions structurantes consignées dans la mémoire auto Claude :

- `project_progress_capture_modal.md` — design final v5 de la modale
- `feedback_auto_replan_no_preview.md` — règle « auto-replan ⇒ pas de UX d'inconsistance »
- `project_calage_run_ratio.md` — décomposition ratio sur runMinutes uniquement
