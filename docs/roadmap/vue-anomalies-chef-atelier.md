# Vue anomalies du chef d'atelier — à discuter et implémenter ultérieurement

> **Statut** : exploration de design, non implémenté. À reprendre quand le modèle de capture optimiste-puis-replan sera stabilisé.

## Pourquoi cette vue existe

Le planning fonctionne en **optimiste** : tant qu'aucune capture ne contredit la prévision, le plan est réputé tenir. C'est le bon défaut côté opérateur (sérénité, pas de pression sur les taps manquants) et côté algo (pas de churn de replan inutile).

Mais l'optimisme aveugle aussi le **chef d'atelier**, dont le métier est précisément de détecter les dérives avant qu'elles deviennent critiques. Sans signal, il les découvre en faisant ses tours physiques de l'atelier — ce qui marche, mais à la limite près que certaines dérives passent sous le radar jusqu'à ce qu'elles cascadent en aval.

Cette vue est l'**inverse du planning** : tout ce que le planning ne dit pas parce qu'il reste optimiste. Sa raison d'être est de *trahir le silence*.

**Si elle est vide, l'atelier va bien. Si elle se remplit, il y a matière à enquête.**

## Le minimum viable

Si on ne devait montrer qu'**une seule chose** : *tâches en chemin critique avec drift confirmé ou silence prolongé*.

Une liste, triée par impact aval, avec :
- **Quoi** : tâche / machine / opérateur
- **Statut** : silence depuis X min, OU drift confirmé +Y min, OU signalement explicite
- **Conséquence** : "J12 sortie atelier décale de Z min", ou "absorbé par slack"

Liste vide = atelier serein. Tout le reste est élaboration.

## Couches qui méritent d'être ajoutées (par valeur décroissante)

**Couche 1 — Signalements explicites de l'opérateur**
Bourrage papier, manque encre, blocage déclaré. Doivent ranker en haut : ils *demandent* une intervention immédiate, pas une enquête.

**Couche 2 — Captures tardives**
"P a validé 5 tâches en bloc à 13h05, toutes 'à l'heure'". Pas une alarme, une trace. Le chef décide de son niveau de confiance dans la déclaration. Sans cette couche, le rattrapage en rafale passe inaperçu.

**Couche 3 — Risques projetés**
"Si A pas finie avant 11h30, J12 (deadline 17h) bascule en retard". Pas une anomalie présente, une *prédiction* qui invite à intervenir avant qu'elle se réalise. Plus complexe à implémenter (forward-pass conséquentiel), mais c'est la couche qui transforme la vue d'observation en outil d'action.

**Couche 4 — Conflits multi-source** (conditionnée à l'existence d'un smartphone porté)
"Tablette M1 : run en cours. Smartphone opérateur assigné : à ST3". Anomalie indétectable autrement. Si pas de smartphone porté, couche vide.

## Modèle de sévérité

**Trier par conséquence aval, pas par âge brut du silence.**

Un silence de 15 min sur une tâche en chemin critique pèse plus qu'un drift confirmé de 2h sur une tâche avec 4h de slack. Trier par âge fait ranker les tâches *visibles* (long silence évident) au-dessus des tâches *importantes* (silence court mais critique). C'est l'inverse de ce que le chef doit voir en premier.

Trois niveaux suffisent :

| Niveau | Définition |
|---|---|
| **Bloquante** | Sortie atelier ou opérateur aval menacés |
| **Modérée** | Drift confirmé, slack aval absorbe |
| **Faible** | Silence, pas encore de preuve de dérive |

## Actions du chef sur une anomalie

Minimum vital :
- **Acquitter** : vu, retire de la vue, pas d'effet sur le plan
- **Saisir par procuration** : le chef capture pour l'opérateur ("A confirmée finie 11h, vu sur place")
- **Pousser un rappel** : notification au smartphone de l'opérateur "merci de saisir A"

À manier avec garde-fou :
- **Forcer replan** : court-circuite le contrat optimiste. Le seul bouton qui *casse* la sérénité du planning. Doit rester explicite et rare — sinon le chef l'utilise par réflexe et on retombe dans le pessimisme déguisé.

## Format

- **Glanceable d'abord** : badge avec compte par sévérité, clic pour la liste, clic pour le détail
- **Mobile-first** : le chef bouge sur le floor, la vue doit vivre sur ce qu'il a en main
- **Superposable au planning** : une anomalie pointe vers sa tuile, le chef voit le contexte plutôt que de jongler entre deux écrans

## Questions ouvertes (à trancher avant implémentation)

- **Notification push** sur "bloquantes" : utile, ou intrusif (le chef préfère découvrir dans son tour) ?
- **Acquittement persistant** : anomalie non acquittée le soir resurgit le matin, ou redémarre à zéro ?
- **Récap fin de journée** : à 18h, "voici les drifts d'aujourd'hui" pour le brief du lendemain — utile, ou redondant avec ce que le chef a vu en temps réel ?
- **"Forcer replan" accessible ou caché** : visible = pratique mais risque d'abus ; caché derrière confirmation = lent mais préserve le contrat optimiste ?
- **Visible des opérateurs ou non** : strictement chef, ou les opérateurs voient aussi les leurs ? Cette dernière question porte un message de design fort. Si l'opérateur voit la vue, elle devient un instrument de pression discrète. Si le chef seul la voit, elle reste un outil de gestion sans culpabilisation. Les deux sont défendables ; le choix conditionne la culture atelier.

## Dépendances

- **Modèle de capture finalisé** : optimiste-puis-replan validé, sémantique "à l'heure" tardif clarifiée, gestion des cascades de saisie tardive arrêtée.
- **Forward-pass conséquentiel exposé** : pour la Couche 3 (risques projetés), il faut pouvoir interroger l'engine "si A glisse de X min, qu'est-ce qui décroche aval ?".
- **Smartphone porté** : Couche 4 conditionnée à cette hypothèse hardware.

## Hors scope (à ne pas confondre)

- Cette vue **n'est pas** un outil de pointage / pointeuse.
- Elle **n'est pas** un dashboard analytique post-mortem (ça, c'est un autre besoin).
- Elle **ne remplace pas** le tour physique du chef — elle l'augmente.
