---
description: Planifier une feature avec Mary, Winston et John
---

# Plan Feature

Planification d'une feature avec trois experts :
- **Mary** (Analyst) - Clarification des requirements
- **Winston** (Architect) - Analyse technique
- **John** (PM) - Découpage et priorisation

## Objectif

Transformer une idée ou un requirement (REQ-XX) en un plan d'implémentation concret, découpé en releases Flux.

## Déroulement

### Phase 1 : Compréhension (Mary)

**Mary analyse le besoin :**
1. Lecture du requirement ou de ta description
2. Questions de clarification
3. Identification des edge cases
4. Formulation claire du problème

**Documents lus :**
- `docs/ux-ui/tmp/backlog.md` - Backlog existant
- `docs/domain-model/` - Règles métier

### Phase 2 : Analyse technique (Winston)

**Winston évalue la faisabilité :**
1. Analyse de l'architecture actuelle
2. Identification des composants impactés
3. Évaluation de la complexité
4. Risques techniques

**Documents lus :**
- `docs/architecture/` - ADRs
- `apps/web/src/` - Code existant

### Phase 3 : Découpage (John)

**John propose un plan :**
1. Découpage en releases atomiques
2. Ordre d'implémentation
3. Estimation effort (S/M/L)
4. Dépendances entre releases

**Documents lus :**
- `docs/roadmap/release-roadmap.md` - Roadmap actuel
- `docs/releases/` - Format des releases

## Output

### Discussion
Par défaut, c'est une discussion. Chaque agent donne son avis et on converge vers un plan.

### Création de documents (si demandé)

Si tu valides le plan et demandes la création des documents :

1. **Release docs** créés dans `docs/releases/`
   - Un fichier par release : `v{VERSION}-{name}.md`
   - Basé sur `docs/releases/_TEMPLATE.md`
   - Langue : **Anglais**

2. **Roadmap** mis à jour dans `docs/roadmap/release-roadmap.md`
   - Nouvelles releases ajoutées
   - Langue : **Anglais**

## Format du plan proposé

```
## Feature Plan: {Nom}

### Requirement
{Description claire du besoin}

### Analyse technique
- Composants impactés : ...
- Complexité : S/M/L
- Risques : ...

### Découpage proposé

| Release | Nom | Description | Effort | Dépend de |
|---------|-----|-------------|--------|-----------|
| v0.3.54 | ... | ... | S | - |
| v0.3.55 | ... | ... | M | v0.3.54 |
| v0.3.56 | ... | ... | S | v0.3.55 |

### Prochaine étape
Tu veux que je crée les release docs ?
```

## Règles

1. **Langue** : Discussion en français, documents en anglais
2. **Granularité** : Chaque release = 1-3 jours de travail max
3. **Autonomie** : Chaque release doit être déployable seule
4. **Compatibilité** : Respecte le workflow existant (`/implement-ui-release`)

## Comment utiliser

Tu peux donner :
- Un REQ existant : `/plan-feature REQ-02`
- Une description libre : `/plan-feature Ajouter la multi-sélection de tiles`
- Rien : `/plan-feature` et je te demanderai ce que tu veux planifier

## Exemple

```
User: /plan-feature REQ-02

[Mary analyse REQ-02 - Auto-scroll on drag]
[Winston évalue la complexité technique]
[John propose un découpage en 3 releases]

Plan proposé :
- v0.3.54-auto-scroll-detection (S)
- v0.3.55-scroll-indicators (S)
- v0.3.56-remove-column-shrinking (M)

Tu veux que je crée les release docs ?
```

---

**Feature à planifier** : $ARGUMENTS
