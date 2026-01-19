# ADR: Job Status Fields UX

**Status:** Draft - En discussion
**Date:** 2026-01-16
**Participants:** Party Mode (Sally UX, Winston Architect, Mary Analyst, Amelia Dev)

## Contexte

Le JobDetailsPanel affiche actuellement les statuts BAT, Papier et Plaques en lecture seule. L'objectif est de permettre leur modification avec une UX claire et une répercussion visuelle sur le job et ses tuiles.

## Décisions validées

### 1. Style des champs éditables

**Choix : Filled field (Option 3)**

- Background `zinc-800` (vs `zinc-900` du panel)
- Hover : `zinc-700`
- Coins arrondis (`rounded-md`)
- Chevron discret pour les dropdowns
- Indicateur visuel clair que le champ est éditable

### 2. Structure des champs BAT

**Choix : Séparer en champs distincts + checkbox bypass**

| Champ | Type | Comportement |
|-------|------|--------------|
| Fichier reçu | DatePicker | Toujours visible (indépendant du BAT) |
| Pas de BAT | Checkbox | Si coché, cache Envoi/Réception BAT |
| Envoi BAT | DatePicker | Masqué si "Pas de BAT" coché |
| Réception BAT | DatePicker | Masqué si "Pas de BAT" coché |

**Rationale :**
- "Fichier reçu" est un jalon indépendant du process BAT
- Même sans BAT requis, on veut tracer la réception des fichiers
- Les dates sont plus explicites que des états textuels

### 3. Champ Papier

**Choix : Dropdown 4 états, réversible**

États : `En stock` → `À commander` → `Commandé` → `Reçu`

Réversible : Oui (corrections possibles)

### 4. Champ Plaques

**Choix : Checkbox "Plaques prêtes"**

Binaire : À faire / Prêtes

### 5. Layout proposé

```
┌─────────────────────────────────────┐
│ FICHIER REÇU                        │
│ │ 12/01 09:00                   ▼ │ │
├──────────── BAT ────────────────────┤
│ ☐ Pas de BAT                        │
│ ENVOI BAT       │ RÉCEPTION BAT     │
│ 15/01 10:30   ▼ │ 18/01 14:00    ▼ │
├──────────── MATIÈRES ───────────────┤
│ PAPIER          │ ☐ Plaques prêtes  │
│ En stock      ▼ │                   │
└─────────────────────────────────────┘
```

### 6. Indicateurs sur tuiles

**Proposition : Badges lettres**

```
F  B  P  L
●  ●  ○  ●
```

| Lettre | Signification | Allumé quand |
|--------|---------------|--------------|
| F | Fichier | `fileReceivedAt` renseigné |
| B | BAT | `proofApprovedAt` renseigné OU `noProofRequired` |
| P | Papier | `paperStatus === 'InStock' \|\| 'Received'` |
| L | pLaques | `platesReady === true` |

## Question ouverte : Niveau Job vs Élément

### Problème identifié

Le modèle actuel place Papier et Plaques au niveau **Job**, mais en réalité :

| Information | Niveau actuel | Niveau réel métier |
|-------------|---------------|-------------------|
| Fichier reçu | Job | **Job** ✓ |
| BAT | Job | **Job** ✓ |
| Papier | Job | **Élément ?** |
| Plaques | Job | **Élément ?** |

### Exemple : Brochure avec couverture + intérieur

```
Job : Brochure 64 pages
├── Élément "couv"
│   ├── Papier : CB350 (carton couché)  ← Différent
│   └── Plaques : À faire
│
└── Élément "int"
    ├── Papier : Offset 90g             ← Différent
    └── Plaques : Prêtes
```

Si le papier de la couverture manque mais celui de l'intérieur est là, l'information actuelle au niveau Job ne permet pas de le savoir.

### Options à considérer

| Approche | Avantage | Inconvénient |
|----------|----------|--------------|
| **Tout au niveau Job** | UI simple | Pas précis |
| **Papier/Plaques au niveau Élément** | Précis | UI plus complexe, modèle à changer |
| **Hybride** (agrégation pour affichage, détail par élément) | Vue job + détail | Plus de développement |

### Questions à trancher

1. **Papier par élément** : En pratique, le papier est-il commandé séparément pour chaque élément ?
2. **Plaques par élément** : Chaque élément a-t-il ses propres plaques (CTP) ?
3. **Cas simplifié** : Y a-t-il des jobs mono-élément où la question ne se pose pas ?
4. **Impact UI badges** : Si niveau élément, comment agréger ? (🟢 tous OK, 🟡 partiel, 🔴 bloquant)

### Impact sur le modèle de données

**Actuel :**
```typescript
interface Job {
  paperPurchaseStatus: PaperPurchaseStatus;
  platesStatus: PlatesStatus;
}

interface Element {
  // Pas de paperStatus ni platesStatus
}
```

**Potentiel :**
```typescript
interface Job {
  fileReceivedAt: string | null;
  noProofRequired: boolean;
  proofSentAt: string | null;
  proofApprovedAt: string | null;
  // Papier et Plaques retirés du Job
}

interface Element {
  paperStatus: PaperPurchaseStatus;
  platesReady: boolean;
}
```

## Prochaines étapes

1. Trancher la question Job vs Élément pour Papier/Plaques
2. Mettre à jour le modèle de données (`@flux/types`)
3. Implémenter les composants UI éditables
4. Ajouter les badges sur les tuiles

## Références

- `apps/web/src/components/JobDetailsPanel/JobStatus.tsx` - Affichage actuel
- `packages/types/src/job.ts` - Interface Job
- `packages/types/src/element.ts` - Interface Element
