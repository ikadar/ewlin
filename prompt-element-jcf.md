# Prompt — DSL d'un élément JCF

Tu vas générer/réviser **un élément** d'un Job Creation Form (JCF). Un job contient N éléments ; chaque élément = une ligne de la table d'éléments + ses 4 toggles de gates. Le header job-level (client, deadline, priorité…) est hors-scope ici.

Pour chaque champ : **label** · **composant d'input** · **statut** (requis / optionnel / calculé) · **sémantique métier** · **règles**.

---

## A. Colonnes de la ligne élément

### Precedences
- **Composant** : `JcfPrecedencesAutocomplete` (CSV de noms d'éléments du même job)
- **Statut** : optionnel
- **Sémantique** : dépendances intra-job — cet élément ne peut pas démarrer avant que les éléments cités soient terminés.
- **Règles** : autocomplete scopée au job courant ; pas de cycle ; pas de self-ref.

### Quantité
- **Composant** : `JcfQuantiteInput` (numérique)
- **Statut** : optionnel (mais quasi-toujours rempli en pratique)
- **Sémantique** : nombre d'exemplaires de cet élément (peut différer de la quantité job, ex. variantes).
- **Règles** : entier ≥ 0 ; entre dans le calcul auto de *Qté feuilles*.

### Pagination
- **Composant** : `JcfPaginationInput`
- **Statut** : optionnel
- **Sémantique** : plage / spec de pagination (ex. `1-10`, `1,3,5`).
- **Règles** : format libre validé côté input ; informatif pour l'imposition.

### Format
- **Composant** : `JcfFormatAutocomplete` *(linkable)*
- **Statut** : optionnel
- **Sémantique** : format produit fini (A4, A3, SRA3…).

### Papier
- **Composant** : `JcfPapierAutocomplete` *(linkable)*
- **Statut** : optionnel
- **Sémantique** : type de papier / support.
- **Règles** : si rempli, *Papier requis* (toggle) bascule à `true` par smart-default.

### Impression
- **Composant** : `JcfImpressionAutocomplete` *(linkable)*
- **Statut** : optionnel
- **Sémantique** : mode d'impression (CMJN, 1 ton, recto/verso…).
- **Règles** : si rempli, *BAT requis* et *Papier requis* basculent à `true` par smart-default.

### Surfaçage
- **Composant** : `JcfSurfacageAutocomplete` *(linkable)*
- **Statut** : optionnel
- **Sémantique** : finition de surface (vernis UV, pelliculage mat/brillant…).

### Autres
- **Composant** : `text`
- **Statut** : optionnel
- **Sémantique** : specs complémentaires libres (rainage, perforation, etc.).

### Imposition
- **Composant** : `JcfImpositionAutocomplete` *(linkable)*
- **Statut** : optionnel
- **Sémantique** : schéma d'imposition / format feuille d'impression (combien de poses par feuille).
- **Règles** : alimente le calcul auto de *Qté feuilles*.

### Qté feuilles
- **Composant** : `text` numérique + switch **auto / manuel**
- **Statut** : **calculé** (override manuel possible)
- **Sémantique** : nombre de feuilles à imprimer.
- **Règles** :
  - Mode auto : `qtéFeuilles = jobQuantité × élément.quantité ÷ imposition` (arrondi métier).
  - Mode manuel : valeur saisie, plus de recalcul auto même si les inputs amont changent.
  - Le switch persiste son état par élément.

### Commentaires
- **Composant** : `textarea` auto-expand
- **Statut** : optionnel
- **Sémantique** : notes opérateur ligne par ligne (consignes, attention spéciale…).

### Sequence
- **Composant** : `JcfSequenceAutocomplete` (mode job) / `WorkflowSequenceAutocomplete` (mode template)
- **Statut** : optionnel (mais structurant pour le scheduler)
- **Sémantique** : **DSL de workflow** — suite ordonnée de machines / étapes que l'élément doit traverser. C'est ce qui détermine les tâches générées pour le scheduler.
- **Règles** :
  - Apprentissage par session (suggère des séquences déjà saisies).
  - Si la séquence contient une machine Typo → *Forme requise* devient `true` par smart-default.
  - Si la séquence contient une presse offset → *Plaques requises* devient `true` par smart-default.

---

## B. Notion de colonne *linkable*

Format, Papier, Impression, Surfaçage, Imposition exposent un **toggle de lien** vers la ligne précédente.

- **Lié** : la cellule **hérite en live** de la valeur de la ligne du dessus ; toute modification amont se propage.
- **Délié** (défaut) : valeur indépendante.
- État stocké dans `JcfElementLinks` (interne au composant), pas dans l'entité Element.
- Usage typique : jobs multi-éléments partageant le même papier/format → ne saisir qu'une fois.

---

## C. Champs additionnels par élément (gates, tri-état)

Quatre toggles **tri-état** (`true` / `false` / `null`) qui contrôlent les *gates* du scheduler. `null` = laisser le smart-default décider ; une valeur concrète **override définitivement**.

| Champ | Smart-default si `null` | Sémantique |
|---|---|---|
| **BAT requis** | `true` si *Impression* renseignée | Gate BAT — la tâche est bloquée tant que le BAT n'est pas validé. La deadline BAT (header) sert de gate amont. |
| **Papier requis** | `true` si *Impression* renseignée | Gate Papier — bloque selon les paramètres admin (cutoff / arrival / offset). |
| **Forme requise** | `true` si *Sequence* contient une machine Typo | Gate Forme — outillage typo. |
| **Plaques requises** | `true` si *Sequence* contient une presse offset | Gate Plaques — flashage des plaques offset. |

> **Piège** : `false` explicite ≠ `null`. Mettre `false` désactive le gate même si le smart-default le voudrait actif. À utiliser pour des cas légitimes (réimpression sans nouveau BAT, papier déjà sur stock, etc.).

---

## D. Règles transverses

- **Mode modification** : tous les champs élément restent éditables (contrairement au header dont 4 champs sont verrouillés).
- **Dropdowns** : composants custom uniquement (`button` + portal popover, nav clavier). Jamais `<select>` natif.
- **Icônes** : `lucide-react` uniquement. Aucun emoji ni glyphe unicode comme icône.
- **Propagation** : changer un champ amont (Impression, Sequence, Imposition) peut modifier des smart-defaults aval — ils ne re-déclenchent **pas** un toggle déjà overridé.
- **Persistance** : un élément vide n'est pas créé ; au moins un champ doit être renseigné.
