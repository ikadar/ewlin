# Modèle de capture du progrès — décisions de design

> **Statut** : décisions arrêtées le 2026-05-04. Tous les items s'appuient sur des composants existants. Une seule question ouverte mineure (cf. fin du doc) : faut-il un canal self-service pour qu'un opérateur déclare son absence sans passer par le chef ?

## Position philosophique

**Optimiste puis replan.** Le plan est présumé tenir tant qu'aucune capture ne le contredit. Le silence est consent. Les replans sont *réactifs*, déclenchés par des contradictions fraîches, jamais par l'absence de confirmation.

Justification :

- Les conséquences d'une vérité tardive sont absorbées par un replan ordinaire — aucune action irréversible n'est déclenchée pendant la période d'opacité, donc pas de coût composé.
- Le pessimisme paie un coût (replans inutiles, alertes superflues, pression sur l'opérateur) pour gérer une minorité de cas qui se résolvent d'eux-mêmes.
- Dans un atelier réactif où les opérateurs voient les machines, où les actions ne sont pas auto-déclenchées sur la base du planning, et où l'humain reste dans la boucle, l'optimisme est strictement supérieur au pessimisme : même résultat final, moins de bruit.

Limite assumée : un drift cumulatif est possible. Le chef d'atelier est l'unique correcteur de divergence — par tour d'atelier, modale d'avancement saisie par procuration, ou palette IA. Aucun mécanisme système ne force la réconciliation.

## Les six décisions

### 1. Capture du départ — non, fin seulement

L'opérateur ne tape qu'à la fin de la tâche. Pas de tap au démarrage.

*Conséquence* : l'algo ne peut anticiper qu'à partir d'une capture de fin ou d'une déclaration explicite de retard via la modale. Pas d'info structurée sur "départ effectif".

### 2. Rayon du replan — global

Quand un replan se déclenche, l'algo recompose le planning à partir de l'instant courant + la nouvelle vérité. Pas de cantonnement local à la machine ou à l'opérateur concerné.

*Conséquence* : meilleure optimisation, plus de tuiles susceptibles de bouger. À surveiller pour la lisibilité visuelle puisque l'auto-replan est instantané (pas de preview/diff).

### 3. Visualisation des tuiles — transition automatique à l'heure prévue

À l'heure prévue de chaque transition (calage → run → terminée), la tuile change d'état dans l'UI **même en l'absence de capture**. L'opérateur voit son atelier "à jour", sans aucun état "présumée" exposé.

*Conséquence* : pas de visuel discriminant entre tâche captée et tâche présumée côté opérateur. La distinction existe en base mais n'est pas exposée dans le rendu courant.

### 4. Tâches sans capture — pas d'outil de réconciliation

Aucun écran spécial ni rituel système ne demande de réconcilier les tâches sans capture en fin de journée ou au matin. Le chef d'atelier intervient via les outils existants (modale d'avancement saisie par procuration, palette IA) au gré de ses tours d'atelier.

*Conséquence* : le chef est *réputé* faire le travail, mais le système ne l'y oblige ni le guide. Si le chef ne le fait pas, le drift s'accumule. Trade-off assumé.

### 5. Anticipation d'un retard — déjà couvert par les outils existants

L'opérateur dispose de deux leviers pour annoncer un retard pendant la tâche :

- **ProgressCaptureModal v5** (`apps/web/src/components/ProgressCaptureModal/`) — question "Quand finirez-vous ?", défaut "à l'heure" (slotEndMin), ajustement libre via QuickActions ou stepper. Déclenche replan.
- **CommandPalette (Alt+K) avec IA** (`apps/web/src/components/CommandPalette/`, `apps/web/src/store/api/consoleApi.ts`) — saisie en langage naturel, propose un plan de mutations, applique sur confirmation.

Aucun nouveau levier à concevoir.

### 6. Événements perturbateurs — absence opérateur et entretien machine

Deux événements explicites déclenchent un replan immédiat :

- **Absence opérateur** : blessure, départ anticipé, etc. L'opérateur devient indisponible ; ses tâches doivent être réaffectées (si profil compatible) ou repoussées.
- **Entretien machine** : la machine est immobilisée pour maintenance. Les tâches sur cette machine doivent être déplacées sur d'autres machines compatibles ou repoussées.

Pas de bouton "blocage" générique : ces deux catégories couvrent les cas réels d'atelier.

## Implémentation — état des lieux

| Décision | Composant | État |
|---|---|---|
| 1. Fin seulement | `ProgressCaptureModal` v5 | ✅ Existe |
| 2. Replan global | Auto-replan engine + `autoRecomputeMiddleware` | ✅ Existe |
| 3. Tuiles auto "terminée" | `Tile.tsx:204-211` — *"no-news = good-news auto-completion"* | ✅ Existe |
| 4. Pas de réconciliation | — | ✅ Aucune action |
| 5. Anticipation modale + IA | `ProgressCaptureModal`, `CommandPalette`, `consoleApi` | ✅ Existe |
| 6. Absence + entretien machine | `OperatorsPage.tsx` (absences L615+) ; `StationsPage.tsx` (scheduleExceptions L106+) ; replan via `autoRecomputeMiddleware` sur `updateOperator`/`updateStation` | ✅ Existe |

## Comment l'IHM existante répond aux questions de l'item 6

| Question | Réponse implicite de l'IHM actuelle |
|---|---|
| Qui déclare l'absence d'un opérateur ? | Le chef (formulaire admin `OperatorsPage`). Pas de self-service opérateur. |
| Durée d'absence ? | Fenêtre date/heure libre (`startAt`, `endAt`) avec champ `reason`. |
| Qui déclare l'entretien machine ? | Le chef (formulaire admin `StationsPage`). |
| Durée d'entretien ? | Fenêtre date/heure libre, même UX que les absences opérateur. |
| Réaffectation auto en cas d'absence ? | Auto-replan engine recompose le planning — réaffecte si profil compatible, repousse sinon. Pas de logique spéciale UI. |

## Question ouverte restante

- **Self-service opérateur pour déclarer une absence ad-hoc** (blessure, départ anticipé) : aujourd'hui passe par le chef via `OperatorsPage`. Faut-il un raccourci opérateur (par ex. depuis un smartphone porté ou la tablette de la machine) pour qu'il déclare lui-même son indisponibilité immédiate sans solliciter le chef ? À trancher si/quand le besoin émerge ; sans déclencheur métier identifié, statu quo.

## Hors scope (choix actifs de NE PAS faire)

- **Pessimiste algo** : explicitement écarté — trop de churn pour le bénéfice.
- **Replan local uniquement** : écarté au profit du global.
- **État visuel "présumée terminée"** côté opérateur : écarté ; sérénité visuelle prioritaire.
- **Roll-over journalier forcé** : écarté ; pas de cérémonie système, le chef gère via outils existants.
- **Bouton "blocage" générique** : remplacé par les deux événements catégorisés (absence, entretien).
- **Vue anomalies chef d'atelier comme pièce structurelle** : reportée comme option de confort future, non requise par le modèle.

## Documents complémentaires

- [Vue anomalies du chef d'atelier (à discuter et implémenter ultérieurement)](./vue-anomalies-chef-atelier.md) — proposition d'observabilité pour le chef, devenue *optionnelle* avec ces décisions (le chef se débrouille avec les outils existants). À reprendre si l'expérience montre un besoin.
