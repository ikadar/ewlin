# Spec : Filtrage par onglets

**Statut :** Brouillon
**Date :** 2026-03-02

---

## 1. Problème

Le Tableau de Flux affiche cinq onglets au-dessus du tableau (« Tous », « À faire prépresse », « Cdes papier », « Cdes formes », « Plaques à produire »), mais seul « Tous » est visuellement actif. Les quatre autres sont des labels statiques sans interaction. L'utilisateur ne peut pas restreindre rapidement le tableau aux jobs nécessitant une action spécifique (par ex. « quels jobs ont du papier à commander ? »).

---

## 2. Objectif

Cliquer sur un onglet filtre le tableau pour n'afficher que les lignes correspondant au critère de cet onglet. L'onglet actif est visuellement distingué, le compteur reflète le nombre de lignes visibles, et les sous-lignes suivent la visibilité de leur parent. Cliquer sur « Tous » restaure l'intégralité du tableau.

---

## 3. Comportement détaillé

### 3.1 Définition des onglets

Il y a exactement 5 onglets, toujours visibles dans cet ordre :

| # | Label | Critère de filtre | Description |
|---|-------|------------------|-------------|
| 1 | Tous | Aucun (tout afficher) | Onglet par défaut, pas de filtrage |
| 2 | À faire prépresse | BAT différent de « OK » et de « n.a. » | Jobs où le travail prépresse est en attente |
| 3 | Cdes papier | Papier = « À cder » | Jobs où le papier doit être commandé |
| 4 | Cdes formes | Formes = « À cder » | Jobs où la forme doit être commandée |
| 5 | Plaques à produire | Plaques = « À faire » | Jobs où les plaques doivent être produites |

### 3.2 Critères de filtre sur les lignes multi-éléments

Pour les jobs à éléments multiples, le filtre s'évalue sur le **statut agrégé le pire** de la ligne parent, pas sur les statuts individuels des sous-éléments.

« Le pire » suit le classement de sévérité existant : rouge > jaune > gris > vert.

**Exemple :** Un job a 2 éléments. L'élément A a Papier = « Cdé » (jaune), l'élément B a Papier = « À cder » (rouge). Le pire des deux est « À cder » (rouge > jaune), donc la ligne parent porte Papier = « À cder ». Quand l'utilisateur clique sur « Cdes papier » (qui teste Papier = « À cder »), ce job apparaît dans les résultats filtrés.

Inversement, si les deux éléments avaient Papier = « Cdé », le pire serait « Cdé » — le job **n'apparaîtrait pas** sous « Cdes papier ».

Le même principe s'applique aux quatre colonnes de prérequis. Les valeurs agrégées par ligne sont listées en section 5.1.

### 3.3 Visibilité des lignes

Quand un filtre est actif :

- Les **lignes parent** correspondant au critère sont visibles ; les autres sont masquées.
- Les **sous-lignes** (lignes de détail des multi-éléments) suivent leur parent : si le parent est masqué, toutes ses sous-lignes le sont aussi ; si le parent est visible, ses sous-lignes restent dans leur état déplié/replié actuel.
- Les lignes dont tous les statuts de prérequis sont « OK », « n.a. » ou verts ne correspondent à aucun filtre autre que « Tous ».

### 3.4 États visuels des onglets

Chaque onglet a exactement deux états visuels : **actif** et **inactif**.

**Onglet actif :**

- Bordure basse : 2px solid bleu (blue-600 / blue-500 en dark mode)
- Texte : contraste élevé (gray-900 / dark-text-primary)
- Fond : surface élevée (white / dark-elevated)

**Onglet inactif :**

- Bordure basse : 2px solid transparent
- Texte : secondaire (gray-600 / dark-text-secondary)
- Fond : aucun (hérite de la barre d'onglets)
- Hover : le texte passe en contraste élevé (gray-900 / dark-text-primary)

Un seul onglet est actif à la fois. Cliquer sur un onglet l'active et désactive tous les autres.

### 3.5 Badge compteur dynamique

Chaque onglet affiche un compteur entre parenthèses après son label, indiquant le nombre de **lignes parent** correspondant au filtre de cet onglet (les sous-lignes ne sont pas comptées).

Format : `({compteur})` — ex. `Tous (5)`, `Cdes formes (1)`.

Les compteurs se mettent à jour dynamiquement : chaque fois qu'un statut de prérequis change (par ex. l'utilisateur modifie un badge via le dropdown listbox), les cinq compteurs d'onglets sont recalculés immédiatement pour refléter les nouveaux résultats de filtrage.

### 3.6 Barre de recherche

Un champ de recherche global est positionné dans la barre d'outils au-dessus des onglets, à gauche du bouton « Nouveau job ». Il permet de filtrer les lignes par recherche textuelle sur toutes les colonnes visibles.

**Markup :**

- Un conteneur `<div>` avec les classes `relative flex-1`
- Une icône loupe SVG positionnée en absolu à gauche (classes `absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-dark-text-tertiary`)
- Un `<input type="text">` avec placeholder `Rechercher...`

**Style du champ :**

- Layout : `w-full pl-10 pr-4 py-2 text-base`
- Bordure : `border border-gray-300 dark:border-dark-border rounded-lg`
- Focus : `focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`
- Fond : `bg-white dark:bg-dark-hover`
- Texte : `text-gray-900 dark:text-dark-text-primary`
- Placeholder : `placeholder-gray-400 dark:placeholder-dark-text-muted`

**Comportement :**

- La saisie filtre les lignes en temps réel (à chaque frappe).
- La recherche est insensible à la casse et correspond à toute sous-chaîne dans les colonnes de texte visibles.
- Le filtrage par recherche se combine avec le filtrage par onglet : les deux conditions doivent être remplies pour qu'une ligne soit visible.
- Vider le champ restaure les résultats du filtre par onglet seul.
- Les sous-lignes suivent la même logique combinée : une sous-ligne n'est visible que si son parent passe à la fois le filtre de recherche et le filtre d'onglet, et que la ligne est dans un état déplié.

### 3.7 Raccourcis clavier

La barre d'outils affiche une zone d'aide aux raccourcis sous les onglets. Ces raccourcis font partie de la spécification.

| Raccourci | Action | Description |
|-----------|--------|-------------|
| `Alt + ←` / `Alt + →` | Changer d'onglet | Passe à l'onglet précédent / suivant. Boucle en fin de liste (dernier → premier, premier → dernier). |
| `Alt + ↑` / `Alt + ↓` | Naviguer les lignes | Déplace le focus sur la ligne parent précédente / suivante visible dans le tableau. |
| `Alt + F` | Rechercher | Place le focus clavier dans la barre de recherche. Si elle a déjà le focus, sélectionne tout le texte. |
| `Alt + N` | Nouveau job | Active le bouton « Nouveau job ». |

**Markup de la zone d'aide :**

Les indications sont affichées alignées à droite dans une barre entre les onglets et le tableau. Chaque raccourci est rendu ainsi :

- Éléments `<kbd>` : `px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-400 dark:border-gray-600 rounded text-sm font-mono`
- Labels : `text-xs text-gray-500 dark:text-dark-text-muted`
- Séparateurs : une barre verticale `|` en `text-gray-300 dark:text-dark-border`, avec marge horizontale `mx-1`

### 3.8 Persistance dans l'URL

L'onglet actif est reflété dans le hash de l'URL afin que l'état du filtre survive au rechargement de la page et puisse être partagé par URL.

**Format du hash :** `#tab={nomFiltre}`

| Hash URL | Onglet actif |
|----------|-------------|
| _(aucun)_ ou `#tab=all` | Tous |
| `#tab=prepresse` | À faire prépresse |
| `#tab=papier` | Cdes papier |
| `#tab=formes` | Cdes formes |
| `#tab=plaques` | Plaques à produire |

**Comportement :**

- Au chargement de la page, si l'URL contient un hash `#tab=...` valide, cet onglet est activé à la place du « Tous » par défaut.
- Quand l'utilisateur clique sur un onglet, le hash de l'URL est mis à jour (via `history.replaceState` ou assignation directe de `location.hash`). Aucun rechargement de page ne se produit.
- Un hash invalide ou non reconnu revient par défaut à « Tous ».

### 3.9 État par défaut

Au chargement de la page (sans hash dans l'URL), l'onglet « Tous » est actif, toutes les lignes sont visibles, et la barre de recherche est vide.

---

## 4. Aperçus visuels

> Voir le fichier interactif : [`mockup.html`](mockup.html)

**Onglet « Tous » — les 5 lignes visibles :**

![Onglet Tous](screenshots/tab-tous.png)

**Onglet « À faire prépresse » — 3 lignes visibles (00078, 00091, 00103) :**

![Onglet Prépresse](screenshots/tab-prepresse.png)

**Onglet « Cdes papier » — 2 lignes visibles (00078, 00091) :**

![Onglet Papier](screenshots/tab-papier.png)

**Onglet « Cdes formes » — 1 ligne visible (00078) :**

![Onglet Formes](screenshots/tab-formes.png)

**Onglet « Plaques à produire » — 2 lignes visibles (00078, 00091) :**

![Onglet Plaques](screenshots/tab-plaques.png)

---

## 5. Logique métier

### 5.1 Données de référence

Chaque ligne parent (pas les sous-lignes) porte quatre valeurs de statut de prérequis utilisées par la logique de filtrage. Ces valeurs correspondent au **pire statut** parmi tous les éléments du job.

| Ligne | BAT | Papier | Formes | Plaques |
|-------|-----|--------|--------|---------|
| 00042 | OK | Stock | n.a. | Prêtes |
| 00078 | Att.fich | À cder | À cder | À faire |
| 00091 | Att.fich | À cder | Cdée | À faire |
| 00103 | Envoyé | Livré | Livrée | Prêtes |
| 00117 | n.a. | Stock | Stock | n.a. |

### 5.2 Algorithme de filtrage

À chaque clic sur un onglet :

1. Identifier la fonction de filtre pour l'onglet cliqué (voir tableau en 3.1).
2. Pour chaque ligne parent du corps du tableau :
   - Évaluer la fonction de filtre sur les valeurs agrégées de prérequis de la ligne.
   - Si la fonction retourne vrai, afficher la ligne ; sinon la masquer.
   - Pour les lignes multi-éléments : trouver toutes les sous-lignes associées. Appliquer la même visibilité que le parent.
3. Mettre à jour le style des onglets : passer l'onglet cliqué à l'état actif, passer tous les autres à l'état inactif.

**Exemple détaillé — filtre « À faire prépresse » appliqué aux données de référence (5.1) :**

- 00042 : BAT = « OK » → exclu (BAT vaut « OK »)
- 00078 : BAT = « Att.fich » → inclus (ni « OK » ni « n.a. »)
- 00091 : BAT = « Att.fich » → inclus
- 00103 : BAT = « Envoyé » → inclus (ni « OK » ni « n.a. »)
- 00117 : BAT = « n.a. » → exclu (BAT vaut « n.a. »)

Résultat : 3 lignes visibles. Correspond à la matrice de vérification (5.4).

### 5.3 Fonctions de filtre (pseudo-code)

```
tous:      toujours vrai
prépresse: ligne.bat != "OK" ET ligne.bat != "n.a."
papier:    ligne.papier == "À cder"
formes:    ligne.formes == "À cder"
plaques:   ligne.plaques == "À faire"
```

### 5.4 Matrice de vérification

Résultats de filtrage attendus pour les données de référence (5.1) :

| Onglet | Lignes parent visibles | Compteur |
|--------|----------------------|----------|
| Tous | 00042, 00078, 00091, 00103, 00117 | 5 |
| À faire prépresse | 00078, 00091, 00103 | 3 |
| Cdes papier | 00078, 00091 | 2 |
| Cdes formes | 00078 | 1 |
| Plaques à produire | 00078, 00091 | 2 |

### 5.5 Association des sous-lignes

Les sous-lignes sont associées à leur parent via un identifiant de job parent. Quand le parent est masqué, toutes ses sous-lignes doivent l'être aussi, quel que soit leur état déplié/replié. Quand le parent est affiché, les sous-lignes retrouvent leur visibilité précédente (déplié ou replié).

### 5.6 Cas limites

| Scénario | Comportement attendu |
|----------|---------------------|
| Filtre actif, l'utilisateur déplie une ligne multi-éléments | Les nouvelles sous-lignes apparaissent (le parent est visible, donc les sous-lignes doivent l'être) |
| Filtre actif, l'utilisateur replie une ligne multi-éléments | Les sous-lignes disparaissent (comportement normal du repli) |
| Le filtre masque une ligne qui était dépliée | Le parent et toutes ses sous-lignes disparaissent. L'état déplié/replié est préservé — en revenant sur « Tous », la ligne réapparaît dans son état déplié |
| Toutes les lignes masquées par le filtre | Le corps du tableau apparaît vide. Aucun message d'état vide n'est requis dans le mockup |

