# Guide du planning automatique — comprendre les décisions de l'algorithme

> **À qui s'adresse ce guide ?** Aux experts métier qui regardent le planning produit par l'outil et qui se demandent parfois *« mais pourquoi a-t-il fait ça ? c'est n'importe quoi »*.
>
> **Spoiler :** dans 95 % des cas, ce n'est pas n'importe quoi. C'est l'application précise de règles que vous avez définies, mais combinées d'une façon qui n'est pas évidente au premier coup d'œil.
>
> Ce guide vous donne les clés pour relire le planning avec l'œil de l'algorithme.

---

## Sommaire

1. [Pour bien démarrer : les 6 entités que tout le monde doit connaître](#1-pour-bien-démarrer)
2. [Le rythme du planning : ticks, horizon, heures de travail](#2-le-rythme-du-planning)
3. [Comment l'algorithme pense : urgence puis placement](#3-comment-lalgorithme-pense)
4. [Comment l'algorithme arbitre : le tuple de score](#4-comment-lalgorithme-arbitre)
5. [Le pipeline complet : Phase rapide → Moore → LNS](#5-le-pipeline-complet)
6. [Les verrous (pins) : qui gèle quoi ?](#6-les-verrous-pins)
7. [La zone de sécurité : ne pas perturber l'immédiat](#7-la-zone-de-sécurité)
8. [Temps masqué : un opérateur, deux machines](#8-temps-masqué)
9. [Péremption du calage : pourquoi des re-calages apparaissent](#9-péremption-du-calage)
10. [Le découpage en chunks : pourquoi une tâche peut être en plusieurs morceaux](#10-le-découpage-en-chunks)
11. [Sous-traitance (ST) : aller, transit, retour](#11-sous-traitance-st)
12. [BAT et précédences : les portes d'entrée](#12-bat-et-précédences)
13. [La règle d'or : on ne place pas à la main](#13-la-règle-dor)
14. [Bestiaire des décisions « bizarres mais correctes »](#14-bestiaire-des-décisions-bizarres-mais-correctes)
15. [Glossaire](#15-glossaire)

---

## 1. Pour bien démarrer

Le planning manipule **six entités**. Si vous gardez ces six mots en tête, tout devient lisible.

### 1.1 Job (commande client)

Une commande passée par un client. Un job a :

- une **date de sortie atelier** (`workshopExitDate`) — c'est la **deadline** que tout le monde regarde ;
- un **niveau d'impérativité** (`deadlinePriority`) sur une échelle de 0 à 3 — voir tableau ci-dessous ;
- une ou plusieurs **éléments**.

| Tier | Libellé   | Sens métier                              | Poids dans l'algo |
|------|-----------|------------------------------------------|-------------------|
| 0    | Impératif | Contractuel, pénalités, ne peut glisser  | **× 4**           |
| 1    | Important | Risque commercial fort                   | × 2               |
| 2    | Standard  | Défaut                                   | × 1               |
| 3    | Flexible  | Peut absorber du retard sans drame       | × 0,5             |

> ⚠️ **Échelle inversée.** 0 est *plus urgent* que 3. C'est volontaire : 0 « passe en premier ».

Conséquence directe : un **impératif retardé d'1 minute compte 8 fois plus** dans le score qu'un flexible retardé d'1 minute. C'est ce qui permet à l'algo de sacrifier un flexible pour sauver un impératif.

### 1.2 Élément

Un job se décompose en éléments physiques (couverture, intérieur, finition…). Les éléments peuvent dépendre les uns des autres (la couverture doit être terminée avant la mise en cartons). C'est le niveau où vivent les **statuts BAT** (voir §12).

### 1.3 Tâche

Une opération unitaire sur **une station** (ou chez **un sous-traitant**). Elle a :

- une **station cible** ;
- une **durée de calage** (`setup_minutes`) — temps fixe pour préparer la machine ;
- une **durée de production** (`run_minutes`) — temps de tirage proprement dit ;
- un **ordre de séquence** dans son élément.

Une tâche est soit **interne** (sur une de vos machines), soit **externalisée / sous-traitée** (chez un prestataire).

### 1.4 Station (machine)

Une machine de l'atelier. Elle a :

- des **horaires d'exploitation** ;
- des **exceptions** (maintenances, fermetures) ;
- éventuellement un **groupe de stations** (ex. les 3 presses offset, capacité simultanée limitée à 2).

### 1.5 Opérateur

Une personne, avec :

- des **compétences** (quelles stations elle sait tenir, et avec quelle productivité) ;
- des **groupes concurrents** (paires de stations qu'elle peut tenir simultanément en temps masqué — voir §8) ;
- des **horaires de travail** et des **absences**.

### 1.6 Groupe de stations

Un ensemble de machines partageant une **contrainte de concurrence**. Exemple : trois presses offset mais seulement deux opérateurs offset disponibles → le groupe a `maxConcurrent = 2`. Même si les trois machines sont libres, l'algorithme refuse d'en faire tourner trois en parallèle.

> **Pourquoi ce niveau d'abstraction ?** Parce que la disponibilité d'un atelier ne se résume pas à « la machine est-elle libre ». Il faut aussi : « ai-je quelqu'un pour la tenir », « le groupe est-il saturé ». Les groupes encodent ces règles globales.

---

## 2. Le rythme du planning

### 2.1 Le tick

L'algorithme ne raisonne pas en minutes mais en **ticks** (créneaux de durée fixe, typiquement 15 min). Tout est arrondi au tick le plus proche : un calage de 22 min consomme 2 ticks. Cette granularité est invisible à l'usage mais explique pourquoi certains horaires apparaissent calés sur des multiples de 15.

### 2.2 Heures de travail vs heures calendaires

C'est **central** et c'est la source numéro 1 d'incompréhension.

L'algorithme **n'utilise jamais les heures calendaires**. Quand on dit *« la zone de sécurité fait 4 heures »*, c'est **4 heures de travail effectif**. Si l'atelier ferme à 17 h et rouvre à 6 h, le décompte saute le créneau de fermeture.

> **Exemple.** Il est 16 h, l'atelier ferme à 17 h. Une zone de sécurité de 4 h ne s'arrête pas à 20 h (calendaire) — elle s'arrête à **9 h le lendemain** (1 h aujourd'hui + 3 h demain matin). Tout ce qui est planifié avant cette borne est gelé, le reste est libre.

Les fermetures atelier (week-ends, jours fériés, vacances) sont aussi des « non-heures » du point de vue de l'algorithme.

### 2.3 Horizon

L'algorithme étend automatiquement son horizon pour **garantir 100 % de placement**. Une tâche n'est jamais « non placée par manque de place ». Si elle ne rentre pas dans la semaine, elle est repoussée à la suivante (avec son lot de lateness).

---

## 3. Comment l'algorithme pense

L'algorithme procède en **deux passes successives**.

### 3.1 Passe arrière (backward) — la carte d'urgence

Pour **chaque tâche**, en partant des deadlines, on remonte le temps :

> *« Si cette tâche prend 2 h et qu'elle doit être finie pour 17 h, elle doit avoir démarré au plus tard à 15 h. »*

Le résultat est un **LAST** (latest acceptable start time) par tâche. C'est une **carte d'urgence** : plus la marge entre le LAST et l'instant présent est faible, plus la tâche est urgente.

> **Pourquoi cette passe ?** Parce que sans elle, l'algorithme ne saurait pas *quoi* placer en premier. Le LAST est le critère d'urgence objectif.

### 3.2 Passe avant (forward) — le placement glouton

On parcourt le temps **du présent vers le futur**, tick par tick. À chaque tick, parmi les tâches **prêtes** (prédécesseurs terminés, opérateur compétent disponible, station libre, BAT validé…), on choisit la **plus urgente** selon la carte d'urgence.

> **« Glouton »** veut dire : à chaque pas, on prend la meilleure décision locale. On ne revient pas en arrière.

C'est rapide, mais ça peut produire des résultats sous-optimaux — d'où la phase d'amélioration LNS qui suit (§5.3).

---

## 4. Comment l'algorithme arbitre

C'est **la** section à comprendre. Si vous saisissez la logique de scoring, 90 % des « bizarreries » du planning deviennent évidentes.

### 4.1 Le tuple de score

L'algorithme évalue chaque planning candidat avec un **tuple de 4 nombres**, comparés **dans l'ordre** (lexicographique) :

```
(unplaced, weighted_late_job_count, weighted_lateness_minutes, makespan_minutes)
```

| Position | Métrique                       | Sens                                                          |
|----------|--------------------------------|---------------------------------------------------------------|
| 1        | `unplaced`                     | Nombre de tâches non placées (devrait toujours être 0)        |
| 2        | `weighted_late_job_count`      | Nombre de **jobs en retard**, pondéré par tier d'impérativité |
| 3        | `weighted_lateness_minutes`    | Somme des minutes de retard, pondérée par tier                |
| 4        | `makespan_minutes`             | Durée totale du planning (du premier au dernier tick utilisé) |

**Lexicographique** signifie : on compare d'abord la 1re valeur ; en cas d'égalité, on compare la 2e ; etc.

### 4.2 Conséquences pratiques

C'est ici que beaucoup d'intuitions humaines se cassent.

#### Conséquence 1 — On préfère **un job moins en retard à plein de jobs un peu en retard**

Si retarder fortement un seul flexible permet d'éviter qu'un autre job ne devienne en retard du tout, l'algorithme le fera. Le **nombre** de jobs en retard pèse **avant** la durée totale du retard.

> **Exemple.** Plan A : 1 job impératif à l'heure, 1 job flexible avec 4 h de retard. Plan B : 2 jobs (un impératif, un flexible) avec 30 min de retard chacun. → **Plan A gagne** (1 job en retard < 2 jobs en retard, malgré 4 h vs 1 h cumulées).

#### Conséquence 2 — On préfère **retarder un flexible plutôt qu'un impératif**

À cause des poids `[4, 2, 1, 0.5]`. Retarder 1 h un impératif coûte autant que retarder 8 h un flexible. L'algorithme fera donc absolument tout pour ne pas toucher à un impératif, même si ça semble injuste pour les autres.

#### Conséquence 3 — Le makespan ne compte qu'**en dernier**

Vous pouvez voir l'algorithme produire un planning qui « traîne » sur 7 jours alors qu'il pourrait visiblement être condensé sur 5. Si la version condensée crée ne serait-ce qu'**1 minute de retard supplémentaire**, la version étalée gagne.

> **À retenir :** **moins de retard prime sur plus court**. Toujours.

---

## 5. Le pipeline complet

Quand l'algorithme calcule un planning, il enchaîne **trois étapes**.

### 5.1 Phase rapide (FBI — Forward Backward Iterations)

Backward + forward (§3) en boucle, avec **promotion d'urgence** : à chaque itération, les jobs encore en retard voient leur tier d'impérativité **boosté d'un cran** (un standard devient important, un important devient impératif). On rejoue jusqu'à stabilisation ou plafond d'itérations.

Cette phase s'exécute en **environ 500 ms**. C'est elle qui produit le résultat affiché *immédiatement* à l'écran après une modification.

### 5.2 Moore — la voie de secours

Si après FBI il reste des jobs en retard, **Moore** essaie deux choses :

1. **Renégocier les priorités inter-tiers** : sacrifier explicitement un standard pour sauver un impératif (en bouger un en tier 3, l'autre en tier 0, et recalculer).
2. **Relâcher la contrainte de concurrence** d'un groupe de stations en dernier recours.

Durée typique : quelques secondes. Objectif : **réduire le nombre de jobs en retard**.

### 5.3 LNS — l'amélioration en arrière-plan

LNS = *Large Neighborhood Search*. C'est une **exploration aléatoire** : on détruit des morceaux du planning, on les reconstruit autrement, on garde si c'est mieux.

LNS tourne pendant **60 secondes en tâche de fond** après que vous voyez déjà votre planning Phase 1 à l'écran. Quand il trouve une amélioration, l'écran se met à jour avec une notification.

> **C'est la cause numéro 1 du symptôme « le planning a bougé tout seul ! »** Non, il s'est *amélioré* — et oui, vous voyez bien le « + Lateness réduite » dans le toast.

LNS ne touche jamais à une tâche pinnée ni à une tâche en zone de sécurité.

---

## 6. Les verrous (pins)

Trois choses peuvent geler une tâche dans le planning. Comprendre **laquelle** s'applique est essentiel pour savoir pourquoi telle tâche ne bouge pas.

### 6.1 Pin utilisateur (cadenas manuel)

L'utilisateur clique l'icône cadenas sur une tuile. La tâche est figée à un **créneau horaire précis** sur **sa station**.

> **Important — sémantique fine.** Le pin verrouille **le créneau, pas l'opérateur**. L'algorithme garde la possibilité de changer l'opérateur affecté si nécessaire. Si vous voulez verrouiller une personne, ce n'est pas via le pin.

**Si le pin devient infaisable** (la station n'est plus dispo à ce créneau), l'algorithme le **glisse au créneau libre le plus proche** et émet un avertissement *« Pin déplacé »* dans une modale. Il ne supprime pas la tâche, il ne casse pas le planning : il rend la main avec un message.

### 6.2 Pin « tâche en cours » (in-progress)

**Définition stricte** : une tâche dont `scheduledStart ≤ maintenant < scheduledEnd` **et** non terminée. Pas de fallback, pas de tolérance : c'est cette fenêtre exacte.

Une tâche en cours est physiquement non déplaçable — la machine est en train de la produire. L'algorithme la traite comme un pin verrouillé.

### 6.3 Pin de zone de sécurité (engine-injected)

Voir §7. Toute tâche qui tombe dans la zone de sécurité reçoit un pin **automatique** au moment du calcul. Vous pouvez l'**override** (dégeler) tâche par tâche via l'icône flocon.

### 6.4 Tableau récapitulatif

| Type de pin     | Origine             | Glisse si infaisable ? | Override possible ? |
|-----------------|---------------------|------------------------|---------------------|
| Utilisateur     | Clic cadenas        | Oui (warning modal)    | Dépinage manuel     |
| In-progress     | État réel monde     | Non — strict           | Non                 |
| Zone de sécurité| Auto-recompute      | Non — verbatim         | Oui (flocon)        |

---

## 7. La zone de sécurité

C'est probablement le concept le moins intuitif.

### 7.1 Le problème qu'elle résout

Vous éditez un détail (les horaires d'un opérateur, par exemple). L'auto-recompute se déclenche. Sans zone de sécurité, **toutes les tâches** seraient candidates à un déplacement — y compris **celle qui démarre dans 20 minutes** sur la presse.

C'est inacceptable opérationnellement. L'opérateur a déjà préparé la prod, on ne peut pas lui dire « finalement, tu fais autre chose ».

### 7.2 La règle

Toute tâche dont le créneau de démarrage tombe dans **les N prochaines heures de travail** est **gelée** (réglage par défaut : **4 heures**, plage configurable 0–8 h).

> **Heures de travail, pas calendaires** : le décompte saute fermetures, week-ends, etc. (voir §2.2).

### 7.3 Comment l'utilisateur la voit

Un **bandeau vertical bleu pâle** apparaît sur la grille du planning, recouvrant la tranche temporelle gelée. Chaque tuile dans la zone porte un **flocon** discret indiquant qu'elle est verrouillée par la zone.

### 7.4 Override

Cliquer le flocon d'une tuile la **libère individuellement** : elle redevient mobile pour le prochain recompute. Utile quand vous savez qu'une tâche programmée pour bientôt va de toute façon être annulée et que vous voulez que le planning s'ajuste tout de suite.

### 7.5 Effet sur les pins de zone

Les pins injectés par la zone de sécurité sont **honorés verbatim** par l'algorithme — il **ne les glisse pas** même si la lecture stricte semble incohérente. Pourquoi ? Parce que la Phase 1 précédente a déjà produit un placement faisable ; les rejouer risquerait de créer des conflits sur des tâches multi-stints (tâches qui s'étalent sur plusieurs créneaux). On fait confiance à la décision passée.

---

## 8. Temps masqué

### 8.1 L'idée métier

Pendant la phase de **production** (calage terminé), un opérateur ne tient plus la machine activement : il **surveille**. Il peut donc, en parallèle, lancer ou surveiller une autre machine compatible.

### 8.2 Le modèle technique

Chaque opérateur peut déclarer un ou plusieurs **groupes concurrents** (paires de 2 stations), avec une **productivité effective par paire et par station** :

```
Groupe 1 :
  - Stations : Offset G37 + Plieuse MBO
  - Productivité : G37 → 0,85 / MBO → 0,90
```

Lecture : *« Cette opératrice peut tenir G37 et MBO simultanément, mais à 85 % et 90 % d'efficacité. »*

L'algorithme tient compte de la **productivité dégradée** : une tâche de 60 min en mode masqué à 85 % consomme l'équivalent de ~70 min de tick.

### 8.3 Les conditions

Pour qu'une tâche soit éligible au mode masqué :

- l'opérateur doit déclarer le groupe ;
- la tâche doit être en **phase de production** (pas en calage) ;
- l'autre tâche du groupe doit aussi exister à cet instant.

Un opérateur sans groupe concurrent travaille à 100 % sur une seule machine à la fois, point.

### 8.4 Pourquoi vous voyez parfois deux tâches sur des machines différentes au même moment, même opérateur

Ce n'est pas un bug. C'est un **groupe concurrent qui s'active**. Vérifiez la fiche opérateur : la paire est déclarée avec ses productivités.

---

## 9. Péremption du calage

### 9.1 La réalité métier

Une presse qu'on a calée, puis qu'on laisse en attente, **se dégrade** : encre qui sèche, registres qui bougent. Au bout d'un certain temps, il faut **re-caler**.

### 9.2 La règle algorithmique

Si une machine reste **inactive plus que `peremption_threshold_minutes`** entre deux périodes de production de la même tâche (par défaut ~2 h), l'algorithme **réinjecte un calage complet** au redémarrage.

### 9.3 Conséquence visible

Sur l'écran, vous voyez parfois une longue tâche découpée en deux blocs avec un **deuxième segment de calage** au début du second bloc. Ce n'est pas une erreur d'affichage — c'est la modélisation de la réalité physique.

> **À retenir :** une tâche qui s'étale sur deux jours coûte plus cher que la même tâche en continu, parce qu'elle paye un calage de plus.

---

## 10. Le découpage en chunks

### 10.1 Pourquoi découper ?

Une tâche très longue qui occupe **toute** une station pendant 12 h bloque tout ce qui voudrait passer par cette station. Si on autorise un découpage en deux chunks de 6 h, on peut intercaler une tâche urgente au milieu.

### 10.2 La règle anti-émiettement

Découper trop finement crée plus de problèmes qu'il n'en résout : chaque chunk paye potentiellement un re-calage (§9), perd du rendement, complexifie la lecture.

L'algorithme impose donc une **fenêtre minimale** par chunk :

```
chunk_mini_ticks = max(
    2,0 × ticks_de_calage,   // un chunk doit "amortir" son calage
    50 % du temps total      // au plus 2 chunks par tâche
)
```

### 10.3 Conséquence

Vous ne verrez (presque) jamais une tâche découpée en plus de 2 morceaux. Vous ne verrez (presque) jamais un chunk qui tient moins du double de son calage. Si c'est le cas, c'est qu'une station précise a une configuration spécifique.

---

## 11. Sous-traitance (ST)

Une tâche externalisée n'occupe **aucune** de vos stations. Pourtant elle apparaît sur le planning avec un fonctionnement particulier.

### 11.1 Trois phases logiques

```
[Aller chez ST]    [Travail chez ST]    [Retour]
   transit_jours      work_jours         transit_jours
```

Chaque phase compte en **jours ouvrables**.

### 11.2 Le cutoff transporteur

Chaque prestataire a une **heure limite** au-delà de laquelle son camion est parti. Si la tâche prédécesseur finit après le cutoff, le départ est repoussé au lendemain ouvré. C'est une vraie source de retard, et c'est **modélisé**.

### 11.3 Comment ça apparaît côté algorithme

Une tâche ST agit comme un **plancher** sur ses successeurs : sa date de retour devient le « plus tôt possible » du successeur. Elle ne consomme ni opérateur, ni station, mais elle **bloque le démarrage en aval**.

### 11.4 Lateness des ST

Une externalisée qui rentre **après** la deadline du job compte dans la lateness du job — exactement comme une tâche interne en retard. Pour l'algo, le retard est le retard, peu importe d'où il vient.

> ⚠️ **Détail technique mais visible** : l'engine renvoie deux moitiés (`assignments` internes + `outsourcedAssignments`). L'UI les fusionne. Si vous voyez une statistique de lateness qui semble incomplète, c'est généralement parce qu'une des deux moitiés n'a pas été parcourue côté lecture — un bug applicatif, pas un bug algorithmique.

---

## 12. BAT et précédences

### 12.1 Précédences inter-tâches

Une tâche **dans un même élément** suit l'ordre de séquence. Une tâche **entre éléments** suit les `prerequisiteElementIds` de l'élément (la couverture après l'intérieur, par exemple).

### 12.2 La porte BAT

**BAT** = *Bon À Tirer*. C'est l'approbation client du fichier avant production. Son statut est porté par l'**élément**.

**Règle :**

- Une **tâche interne** d'un élément E ne peut démarrer que si `E.batStatus` est *Ready* (`none` ou `bat_approved`).
- Une **tâche externalisée** d'un élément E ne peut démarrer que si **tous les prérequis de E** ont leur BAT prêt.

### 12.3 Comment c'est implémenté

Quand la condition n'est pas remplie, le PHP injecte un **`earliestStartTick`** sur la tâche, calculé à partir du champ `Job.batDeadline`. L'algorithme refuse alors tout placement avant ce tick.

### 12.4 Conséquence visible

Une tâche qui semble « inexplicablement » repoussée plus tard que sa première fenêtre disponible : vérifiez le **statut BAT** de l'élément. Tant qu'il n'est pas Ready, l'algorithme respecte le plancher imposé. **Et un pin utilisateur sous ce plancher est dégradé** (warning : *« pin déplacé après la BAT deadline »*).

---

## 13. La règle d'or

### 13.1 Pas de placement manuel

Vous ne pouvez **pas** dire à l'algorithme « place T3 à 14 h sur la presse ». Il n'y a pas de glisser-déposer. Il n'y a pas de clic-pour-placer.

### 13.2 Trois actions seulement

| Action          | Effet                                                    |
|-----------------|----------------------------------------------------------|
| **Pin/unpin**   | Verrouiller/déverrouiller un créneau                     |
| **Override**    | Dégeler une tâche en zone de sécurité                    |
| **Recompute**   | Recalculer (auto sur édition, manuel sur Alt+P)          |

Tout le reste — placer, déplacer, optimiser — est la responsabilité de l'algorithme.

### 13.3 Pourquoi ?

Parce que la cohérence du planning repose sur les contraintes (capacité, précédences, opérateurs, BAT…). Un placement manuel hors algo ouvre la porte aux incohérences. Vous voulez forcer un créneau ? **Pinnez.** L'algorithme adaptera le reste.

### 13.4 Auto-recompute

Toute mutation significative (création/édition de job, absence opérateur, exception machine, BAT validé…) **redéclenche un calcul**. Phase 1 en 500 ms (visible immédiatement), puis Phase 2 LNS pendant 60 s en arrière-plan.

> Un toast vous prévient si LNS a trouvé mieux pendant la phase de fond. Cliquer le toast actualise la vue.

---

## 14. Bestiaire des décisions « bizarres mais correctes »

Une lecture rapide : avant de crier au bug, parcourez cette section. La plupart de vos « *mais qu'est-ce qu'il fait ?* » sont là.

### 14.1 « Le planning a bougé tout seul après mon dernier clic »

**Probable** : LNS a tourné 60 s en fond et a trouvé une meilleure réorganisation. Vous avez vu le planning Phase 1 d'abord, puis Phase 2.

**Si vous ne voulez pas** que ça bouge : pinnez les tâches concernées.

### 14.2 « Cette tâche pourrait clairement passer plus tôt, pourquoi est-elle si tard ? »

**À vérifier dans l'ordre** :

1. Un **prédécesseur** la bloque (élément amont, ou autre tâche du même élément).
2. Le **BAT** de son élément (ou d'un prérequis pour les ST) n'est pas prêt → plancher imposé.
3. Sa **station** est occupée par une tâche plus urgente (LAST plus serré).
4. Le **groupe** de la station est saturé (capacité du groupe atteinte).
5. L'**opérateur compétent** est absent ou déjà occupé.
6. La tâche est en **zone de sécurité** sur sa position actuelle (gelée).
7. Un **pin** la verrouille (vérifier l'icône cadenas).

L'algorithme n'invente jamais de retard. Il subit une contrainte. À vous de la trouver.

### 14.3 « Ce job impératif est en retard alors qu'on a la capacité ! »

C'est rare mais ça arrive. Causes possibles :

- Un **autre impératif** plus urgent encore monopolise la même station.
- La **précédence intra-job** (un élément amont prend tout le temps).
- Un **BAT** non validé (le plancher repousse mécaniquement).
- L'**opérateur unique compétent** sur une station-clé est en absence.

Vous pouvez confirmer en regardant la chaîne complète des tâches du job, en remontant.

### 14.4 « Ces deux tâches sont sur le même opérateur, en même temps ! »

Pas un bug si elles sont dans un **groupe concurrent** déclaré sur cet opérateur (§8). Vérifiez la fiche opérateur.

Si elles ne sont pas dans un groupe : c'est un bug, signalez-le.

### 14.5 « Cette longue tâche est coupée en deux, ça n'a aucun sens »

Probablement le **chunk-mini guard** (§10) en action : la tâche dépasse la durée seuil, l'algo l'a découpée pour permettre l'intercalage de tâches plus urgentes. Le second segment paye un re-calage si l'écart entre les deux dépasse le seuil de péremption (§9).

### 14.6 « Il a sacrifié un job standard pour sauver un flexible, c'est absurde »

Vraiment absurde, ça l'est — mais l'algo ne le fait pas spontanément. Si vous observez ça :

- Vérifiez les **tiers** réellement enregistrés (le standard est-il bien tier 2 et le flexible tier 3 ?).
- Vérifiez les **deadlines** : un flexible avec une deadline ce soir pèse plus qu'un standard avec une deadline dans 3 semaines.
- Vérifiez la **chaîne de précédences** : peut-être que toucher au standard cassait un autre chemin critique.

Le poids `[4, 2, 1, 0.5]` ne s'inverse jamais.

### 14.7 « La modale dit "Pin déplacé", pourquoi ? »

Votre pin pointait vers un créneau **infaisable** (station indispo, opérateur absent, sous le plancher BAT). L'algorithme a glissé le pin au prochain créneau faisable. Le pin reste actif, juste à un nouveau timestamp. Vous pouvez l'accepter ou le retirer.

### 14.8 « La zone de sécurité refuse de bouger une tâche que je voudrais déplacer »

Cliquez le **flocon** sur la tuile : ça la sort de la zone pour le prochain recompute. Si vous voulez désactiver la zone globalement, c'est dans les réglages (plage 0–8 h, défaut 4 h).

### 14.9 « Le makespan a augmenté, le planning est moins bon »

Pas forcément. Si la **lateness a baissé** (ne serait-ce que d'1 minute pondérée), l'algorithme préfère le planning plus long. **Lateness > makespan** dans le tuple de score (§4).

### 14.10 « Cette ST devrait pouvoir partir aujourd'hui »

Vérifiez le **cutoff** du prestataire (§11.2). Si la tâche prédécesseur finit après le cutoff, l'aller saute au lendemain ouvré.

---

## 15. Glossaire

| Terme                          | Définition courte                                                                            |
|--------------------------------|----------------------------------------------------------------------------------------------|
| **BAT**                        | Bon À Tirer ; statut d'approbation client porté par l'élément, conditionne le démarrage      |
| **Backward pass**              | Calcul d'urgence : remonte les deadlines pour calculer le LAST de chaque tâche               |
| **Calage / setup**             | Préparation machine, durée fixe en début de tâche                                            |
| **Chunk**                      | Sous-fragment d'une longue tâche découpée pour permettre l'intercalage                       |
| **Chunk-mini guard**           | Garde-fou anti-émiettement : un chunk doit amortir son calage et ne pas être trop court      |
| **Compute fast (Phase 1)**     | Premier calcul rapide (~500 ms), affichage immédiat                                          |
| **Compute LNS (Phase 2)**      | Amélioration en arrière-plan (60 s), met à jour si mieux                                     |
| **Cutoff (ST)**                | Heure limite de passage du transporteur du prestataire                                       |
| **Deadline priority**          | Tier d'impérativité 0–3 (impératif/important/standard/flexible), échelle inversée            |
| **Forward pass**               | Placement glouton tick par tick                                                              |
| **Groupe concurrent**          | Paire de stations qu'un opérateur peut tenir simultanément (temps masqué)                    |
| **Groupe de stations**         | Ensemble de machines avec contrainte de capacité simultanée                                  |
| **Heures de travail**          | Heures réelles d'exploitation, fermetures exclues — base de tous les calculs                 |
| **Horizon**                    | Étendue temporelle du planning, étendue automatiquement pour garantir 100 % de placement     |
| **LAST**                       | Latest acceptable start tick — moment au plus tard où une tâche doit démarrer                |
| **Lateness**                   | Minutes de retard d'une tâche par rapport à la deadline du job                               |
| **Lexicographique**            | Mode de comparaison de tuples : on compare position 1 d'abord, puis 2 si égal, etc.          |
| **LNS**                        | Large Neighborhood Search ; phase d'amélioration aléatoire en arrière-plan                   |
| **Makespan**                   | Durée totale du planning, du premier au dernier tick utilisé                                 |
| **Moore**                      | Phase de secours entre FBI et LNS, renégocie les priorités pour réduire les retards          |
| **Override (zone de sécu)**    | Dégeler une tâche individuellement (icône flocon)                                            |
| **Péremption**                 | Calage qui « sèche » si la machine reste inactive trop longtemps → re-calage au redémarrage  |
| **Pin / Pin utilisateur**      | Verrou de créneau posé par l'utilisateur (cadenas)                                           |
| **Pin in-progress**            | Verrou implicite d'une tâche en cours d'exécution maintenant                                 |
| **Pin de zone de sécurité**    | Verrou implicite injecté pour les tâches dans la fenêtre 4 h gelée                           |
| **Productivité effective**     | Coefficient appliqué quand un opérateur tient deux machines en temps masqué                  |
| **Recompute**                  | Recalcul du planning, automatique sur édition ou manuel via Alt+P                            |
| **Run / production**           | Phase de tirage proprement dit, après le calage                                              |
| **Score tuple**                | `(unplaced, weighted_late_jobs, weighted_lateness, makespan)` — comparé lexicographiquement  |
| **ST / Sous-traitance**        | Tâche externalisée : aller, transit, travail prestataire, retour                             |
| **Temps masqué**               | Mode où un opérateur surveille deux machines avec productivité dégradée                      |
| **Tick**                       | Unité atomique de temps de l'algorithme (15 min typiquement)                                 |
| **Tier weight**                | Pondération `[4, 2, 1, 0.5]` appliquée à la lateness selon l'impérativité du job             |
| **Unplaced**                   | Tâche non assignée — devrait toujours être 0 (l'horizon s'étend pour garantir le placement)  |
| **Zone de sécurité**           | Fenêtre de 4 h de travail gelée pour ne pas perturber l'imminent                             |

---

## En une phrase

> L'algorithme **minimise d'abord le nombre de jobs en retard** (pondéré par tier d'impérativité), **ensuite la durée totale de retard** (pondérée pareil), **enfin la durée totale du planning** — dans cet ordre, sans concession ; tout le reste (pins, zone de sécurité, BAT, temps masqué, péremption, chunks, ST) sont les contraintes qui encadrent cette optimisation.

Si une décision du planning vous surprend, **ce n'est pas l'algorithme qui a tort** : c'est qu'une de ces règles s'applique d'une façon qui n'était pas évidente. Ce guide vous donne les pistes à creuser dans l'ordre.

Bonne lecture du planning.
