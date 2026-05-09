# Règles du mur, de l'avancement et de la replanification

Document de référence — règles atomiques régissant Prod, Préprod, le mur, la saisie, le calage hérité et la replanification d'une tâche partiellement exécutée.

Chaque règle est numérotée et conçue pour être référençable individuellement.

## 1. Prod et Préprod

1.1. **Prod** est la planification officielle qui pilote l'atelier en ce moment.

1.2. **Préprod** est un bac à sable dans lequel l'utilisateur teste des changements avant de les valider.

1.3. L'utilisateur peut consulter Prod ou Préprod à tout moment. Ce sont deux vues distinctes.

1.4. **Promouvoir** Préprod en Prod = remplacer la planification officielle par celle du bac à sable. Cette opération est explicite (clic utilisateur).

1.5. La promotion ne modifie pas le mur. Seules les décisions de planification (placements, durées modifiées en JCF, jobs créés/supprimés) sont copiées de Préprod vers Prod.

1.6. **Annuler une promotion** = revenir à l'état de Prod juste avant le clic "promouvoir". L'annulation s'appuie sur une copie technique appelée *archive*, créée automatiquement au moment de chaque promotion (invisible à l'utilisateur).

## 2. Le mur

2.1. Le **mur** est la zone qui contient les **données de la réalité physique** ou des **engagements externes**, et **rien d'autre**.

2.2. Sont sur le mur :
   - L'avancement constaté (calage fait, minutes-effort de roule consommées, qui a fait quoi quand)
   - L'état du papier (commandé, livré)
   - L'état du BAT (envoyé, approuvé)
   - L'état des formes / plaques (commandées, livrées)
   - Les deadlines contractuelles (sortie atelier, livraison)
   - La productivité opérateur déclarée par saisie

2.3. Le mur est **partagé** entre Prod et Préprod : la réalité est la même quel que soit le bac à sable consulté.

2.4. Le mur **ne se tripote pas** en Préprod. L'utilisateur ne peut pas hypothétiser une donnée du mur.

2.5. Le mur est mis à jour de **deux** manières seulement :
   - Le temps qui passe (écriture automatique présumée)
   - Une saisie opérateur (écriture explicite)

2.6. Le mur est **canonique**. Toute donnée qui n'est ni de la réalité physique constatée ni un engagement externe **n'a pas sa place sur le mur**.

## 3. La saisie d'avancement

3.1. Une saisie d'avancement = une déclaration explicite de l'opérateur sur l'état réel d'une tâche.

3.2. Une saisie écrase la présomption automatique du moment.

3.3. Une saisie est **verbatim** : une fois écrite, elle ne se réécrit pas, sauf par une nouvelle saisie de l'opérateur lui-même.

3.4. Une saisie marque la tâche comme "déclarée par opérateur". Le système identifie cet état via `last_saisie_at != NULL`.

3.5. Une tâche déclarée par opérateur n'est plus modifiée par les écritures automatiques (cron, replans, retours en arrière de NOW).

## 4. Le silence vaut consentement

4.1. Tant qu'aucune saisie ne contredit la planification, la tâche est présumée se dérouler **exactement comme prévu**.

4.2. Une tâche dont le créneau planifié est passé, sans saisie ni `is_completed`, est **présumée terminée à l'heure prévue**, pas en retard.

4.3. Le passé est verbatim : le mur enregistre **automatiquement** l'avancement présumé au fil du temps.

4.4. "En retard" = la tâche/job va manquer (ou a manqué) sa **deadline livraison**. Pas "personne n'a confirmé".

4.5. Aucun indicateur d'interface ne doit transformer "pas de saisie" en alerte sur une tâche passée.

## 5. Le stockage de l'avancement (effort-minutes)

5.1. L'avancement est stocké en **minutes-effort consommées**, c'est-à-dire en minutes-référence-JCF (équivalent productivité 1).

5.2. La conversion vers le wall-clock dépend du ratio de productivité de l'opérateur qui exécute :  
`temps_wall_clock = minutes_effort × ratio_opérateur`.

5.3. Les minutes-effort consommées restent **invariantes** quand :
   - La durée JCF de la tâche change par modification (le 30 min-effort fait reste 30 min-effort fait, peu importe que runMinutes passe de 90 à 120)
   - Un autre opérateur reprend la suite avec un ratio différent (le 30 min-effort fait reste 30 min-effort fait)

5.4. Le pourcentage d'avancement est **dérivé**, pas stocké :  
`pct = minutes_effort_done / runMinutes_actuel × 100`.

5.5. Le ratio de productivité d'une tâche est stocké séparément, sur le mur, et n'est jamais touché par les écritures automatiques.

## 6. Le calage hérité

6.1. Le calage est une opération de mise en route d'une machine pour une tâche.

6.2. Le calage est **par-machine** : il est valide uniquement sur la station où il a été effectué.

6.3. Le mur stocke `last_setup_at` (instant de fin du calage) et `last_setup_station_id` (station du calage) pour chaque tâche.

6.4. Le calage **peut expirer** au bout d'un certain temps (péremption). La règle de péremption est globale au système.

6.5. Le calage **peut être volé** par une autre tâche : si une autre tâche fait un calage sur la même station entre-temps, l'ancien calage n'est plus valide même s'il n'est pas périmé.

6.6. Au moment de la replanification d'une tâche dont le calage a été constaté :
   - Si le calage est sur la même station ET non périmé ET non volé → **conservé**, pas de nouveau calage planifié.
   - Sinon → **nouveau calage planifié** (durée complète du calage à refaire).

6.7. Le calage hérité conservé n'apparaît pas dans la planification future (la tuile commence directement par le run restant).

## 7. La modification JCF (JCF modif)

7.1. La JCF modif permet à l'utilisateur de modifier la séquence de tâches d'un élément après sa création initiale.

7.2. La JCF modif s'effectue **dans Préprod**. Elle ne touche pas Prod tant que l'utilisateur ne promeut pas.

7.3. Champs verrouillés en JCF modif (non modifiables) : 4 champs d'en-tête + 10 champs du tableau qui préservent l'identité logique des tâches existantes.

7.4. Sur une **tâche partiellement exécutée** (avancement non nul) :
   - Le temps déjà fait s'affiche **au-dessus** du champ séquence (information de contexte).
   - Le champ séquence est **pré-rempli** avec la tâche en cours en première ligne :
     - Calage : durée normale (le calage existant peut être hérité ou refait à la replanification — l'utilisateur n'arbitre pas ce choix).
     - Run : durée **réduite** = `runMinutes − minutes_effort_done`.
   - L'utilisateur peut éditer la séquence à partir de cette base.

7.5. La modification de la durée d'une tâche en JCF modif **ne réinitialise pas** l'avancement. Les minutes-effort consommées restent vraies (cf. 5.3).

7.6. La JCF modif peut **annuler** une tâche existante. La donnée d'avancement éventuellement présente sur le mur reste, mais devient orpheline (aucun élément actif ne la référence).

7.7. La JCF modif peut **créer** une nouvelle tâche. Une nouvelle tâche démarre sans avancement.

## 8. La productivité opérateur

8.1. La **productivité** d'un opérateur sur une tâche est un ratio adimensionnel.

8.2. Ratio = `temps_planifié_JCF / temps_wall_clock_réel`. Convention de la productivité au sens commun (sortie par unité de temps). Donc :
   - Ratio > 1 : opérateur plus **rapide** que la référence (productivité supérieure)
   - Ratio < 1 : opérateur plus lent
   - Ratio = 1 : conforme au plan

8.3. Le ratio est **dérivé d'une saisie** (l'opérateur déclare une heure de fin réelle, le système calcule).

8.4. Le ratio est **opérateur-only** : il n'est jamais écrit par le système automatiquement.

8.5. Un ratio NULL signifie "pas de saisie de l'opérateur sur cette tâche, le système suppose 1.0".

8.6. Conversion entre minutes-effort et wall-clock :
   - `temps_wall_clock = minutes_effort / ratio` (un opérateur productif consomme moins de wall-clock pour le même effort)
   - `minutes_effort = temps_wall_clock × ratio`

8.7. Bornes de garde-fou : ratio clampé dans `[0.2, 10.0]` à la saisie. 0.2 = au plus 5× plus lent ; 10.0 = au plus 10× plus rapide. Une saisie qui produirait une valeur hors bornes est ramenée à la borne, pas rejetée.

8.8. **Limitation connue** : le ratio est stocké au niveau de la tâche (sur le mur), pas par opérateur. Si un opérateur A (lent) saisit puis un opérateur B (rapide) reprend, le ratio enregistré reste celui de A jusqu'à la prochaine saisie. À surveiller dans les cas de relais en cours d'exécution.

## 9. L'override de NOW (mode test)

9.1. L'override de NOW est un mécanisme de test qui permet de faire avancer (ou reculer) le temps perçu par le système.

9.2. L'override est un **offset** appliqué sur le wall-clock : `temps_perçu = wall_clock + offset`. Le temps avance toujours à la vitesse réelle.

9.3. L'override de NOW affecte :
   - Le rendu visuel (FE)
   - La replanification
   - Les écritures du mur (cron tick)
   - La saisie opérateur

9.4. L'override de NOW n'affecte **pas** :
   - Les `updated_at` Doctrine, `created_at` réels (forensique)
   - Les logs serveur
   - Les timeouts d'instrumentation

9.5. Quand l'override change, le système doit immédiatement **réconcilier le mur** avec le nouveau NOW :
   - Tâches qui sont maintenant passées sans saisie → finalisées (silence vaut consentement)
   - Tâches qui étaient finalisées par silence et redeviennent futures → désinstaurées (rollback automatique)
   - Tâches en cours → ré-ancrées avec le nouvel avancement présumé

9.6. L'override n'efface jamais une saisie opérateur, même si elle pointe maintenant vers le futur (incohérence acceptée).

## 10. Le partage cross-scenario du mur

10.1. Chaque tâche logique a un identifiant stable `logical_task_id` qui survit aux copies entre Prod, Préprod, archives et autres copies internes.

10.2. Le mur (effort consommé, calage fait, saisie opérateur, productivité) est **stocké une seule fois** par tâche logique, partagé par toutes les copies.

10.3. Une saisie effectuée en Prod est **immédiatement** visible en Préprod, sans propagation à coder. Réciproque vraie.

10.4. Les décisions de planification (placements, choix de station, statut de complétion par scénario) restent **par scénario**, pas sur le mur.

10.5. Les archives lisent le mur **vivant** (pas figé au moment de l'archivage). Une archive ouverte demain montre l'avancement de demain, pas celui d'hier — c'est volontaire (cf. 1.6, archives = mécanique d'undo, pas photo historique).

## 11. Réactivité de la planification

11.1. **Prod replan automatiquement** quand la réalité bouge :
   - Saisie d'avancement
   - Changement papier / BAT / forme / plaque
   - Externalisation
   - Mutation Flux (Aller-simple, etc.)

11.2. **Préprod ne replan pas automatiquement** sur changement de réalité.

11.3. Préprod replan uniquement quand l'utilisateur déclenche explicitement un calcul (clic, modification d'un job en JCF modif, etc.).

11.4. Justification de 11.2 : Préprod doit être stable comme bac à sable. Si Préprod bougeait à chaque saisie, l'utilisateur ne pourrait pas tester sereinement.

## 12. Replanification d'une tâche partiellement exécutée

Cas où l'utilisateur **lève la tuile** d'une tâche partiellement faite, puis demande au système de **la replacer** automatiquement.

### 12.1. État 1 — Calage commencé seulement (en cours de calage)

**Diagnostic** : `NOW` est entre `scheduled_start` et `scheduled_start + setup_minutes`. Le calage a démarré mais n'a pas fini.

**État du mur** :
- `last_setup_at` = NULL (le calage n'a pas atteint sa fin)
- `effort_minutes_done` = 0 (le run n'a pas démarré)

**Quand on lève la tuile** : l'assignment Préprod est supprimée. Le mur reste inchangé (rien à inscrire — le calage n'était pas fini).

**Quand on replan en auto** : le système ne détecte aucune trace de calage validé. Il replanifie la tâche **complète** : `[calage normal] + [run normal]`. Le calage en cours est perdu — c'est cohérent avec la sémantique "le calage n'est consigné qu'à sa fin".

**Conséquence pratique** : si l'utilisateur souhaite préserver le calage en cours, il doit attendre la fin du calage (ou saisir manuellement une fin de calage anticipée si la fonctionnalité existe) avant de lever la tuile.

### 12.2. État 2 — Calage fini, roule pas commencée

**Diagnostic** : `NOW` est entre `scheduled_start + setup_minutes` et la durée de calage est terminée mais le run n'a pas démarré (cas rare en pratique : transition immédiate normale, mais possible si pause juste après calage).

**État du mur** :
- `last_setup_at` = X (instant de fin du calage)
- `last_setup_station_id` = Y (la station)
- `effort_minutes_done` = 0

**Quand on lève la tuile** : l'assignment Préprod est supprimée. Le mur reste inchangé.

**Quand on replan en auto** : le moteur arbitre l'**héritage de calage** :
- Si la nouvelle position est sur la station Y, ET le calage n'est pas périmé, ET le calage n'est pas volé → **calage hérité** : la nouvelle tuile contient `[run complet]` seulement, sans calage.
- Sinon → **calage refait** : la nouvelle tuile contient `[calage normal] + [run complet]`.

### 12.3. État 3 — Calage fini, roule commencée

**Diagnostic** : `NOW` est dans la phase run de la tâche. Le calage est terminé, des minutes-effort de run ont été consommées.

**État du mur** :
- `last_setup_at` = X (instant de fin du calage)
- `last_setup_station_id` = Y (la station)
- `effort_minutes_done` = N (N > 0, minutes-effort de run consommées)
- `recorded_at` = Z (instant du dernier ancrage du compteur d'effort)

**Quand on lève la tuile** : l'assignment Préprod est supprimée. Le mur reste inchangé — N minutes-effort sont déjà consommées dans la réalité, on ne les efface pas.

**Quand on replan en auto** : le moteur arbitre l'héritage de calage **et** utilise le run partiel :

| Calage hérité ? | Tuile replanifiée |
|---|---|
| Oui (station Y, non périmé, non volé) | `[run réduit = (runMinutes − N) effort-min]` |
| Non (autre station ou périmé ou volé) | `[calage normal] + [run réduit = (runMinutes − N) effort-min]` |

**Précisions** :
- Le run partiel reste vrai même si le calage est invalidé : le travail physique de N minutes-effort a réellement été fait.
- Le wall-clock du run réduit dépend du ratio de l'opérateur affecté à la nouvelle position : `wall_clock_run_restant = (runMinutes − N) × ratio_nouveau_opérateur`.
- Si `N ≥ runMinutes`, le run restant est 0 — la tâche est intégralement terminée et ne nécessite pas de replanification.

### 12.4. Règles transverses aux trois états

12.4.1. Lever une tuile **n'efface jamais** les données du mur. La levée est une opération sur la planif (Préprod), pas sur la réalité.

12.4.2. Le replan en auto **ne réinitialise jamais** le mur. Le replan lit le mur comme entrée et produit une nouvelle planif comme sortie.

12.4.3. Si l'utilisateur souhaite **réinitialiser** l'avancement (rare), il doit le faire explicitement via "réinitialiser saisies" — opération distincte de la levée+replan.

12.4.4. Une saisie opérateur (`last_saisie_at != NULL`) sur la tâche est **prioritaire** sur toute écriture automatique. Si un opérateur a déclaré "j'en suis à 60%", le replan utilise 60% comme base de calcul, même si le `effort_minutes_done` calculé automatiquement diffère.
