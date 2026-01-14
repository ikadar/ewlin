---
description: Code review avec Amelia (Dev) et Murat (QA)
---

# Code Review

Review de code par deux experts : **Amelia** (développeuse senior) et **Murat** (architecte QA).

## Agents actifs

| Agent | Focus |
|-------|-------|
| **Amelia** (Dev) | Clean code, patterns, performance, maintenabilité |
| **Murat** (QA) | Tests, edge cases, robustesse, sécurité |

## Catégories d'analyse

### 1. Bugs potentiels 🐛
- Null/undefined non gérés
- Race conditions
- Memory leaks
- Erreurs de logique

### 2. Performance ⚡
- Re-renders inutiles (React)
- Calculs coûteux non memoizés
- Bundles trop gros
- Requêtes inefficaces

### 3. Sécurité 🔒
- XSS potentiel
- Injection
- Données sensibles exposées

### 4. Lisibilité 📖
- Nommage
- Complexité cyclomatique
- Fonctions trop longues
- Code dupliqué

### 5. Tests manquants 🧪
- Cas non couverts
- Edge cases
- Tests E2E nécessaires

### 6. Conventions du projet 📏
- Patterns React (hooks, composants)
- TypeScript strict
- Tailwind CSS
- Structure de fichiers

## Déroulement

### Phase 1 : Analyse

Je lis le code spécifié et j'identifie les problèmes.

### Phase 2 : Rapport

Je présente les findings avec ce format :

```
## Code Review Report

### 🐛 Bugs (Critical)
1. **[fichier:ligne]** Description
   - Impact : ...
   - Suggestion : ...

### ⚡ Performance (High)
1. **[fichier:ligne]** Description
   - Impact : ...
   - Suggestion : ...

### 📖 Lisibilité (Medium)
1. **[fichier:ligne]** Description
   - Suggestion : ...

### 🧪 Tests manquants (Medium)
1. **[fichier]** Test case manquant
   - Ce qu'il faudrait tester : ...

### ✅ Points positifs
- Point 1
- Point 2
```

### Phase 3 : Corrections (optionnel)

Je te demande : "Tu veux que je corrige certains de ces problèmes ?"

Si oui :
- Je corrige les fichiers directement
- Je montre les modifications
- Tu valides avant de commit

## Niveaux de sévérité

| Niveau | Description | Action |
|--------|-------------|--------|
| **Critical** | Bug ou faille de sécurité | Corriger immédiatement |
| **High** | Performance ou maintenabilité | Corriger avant merge |
| **Medium** | Améliorations recommandées | Corriger si temps |
| **Low** | Suggestions mineures | Optionnel |

## Comment spécifier le code à reviewer

Tu peux donner :
- Un fichier : `/code-review apps/web/src/components/Tile/Tile.tsx`
- Un répertoire : `/code-review apps/web/src/components/Tile/`
- Les derniers changements : `/code-review` (sans argument, je regarde git diff)

## Règles

1. **Langue** : Discussion en français
2. **Code** : Corrections et commentaires en anglais
3. **Respect** : Critique constructive, jamais personnelle
4. **Pragmatisme** : On ne cherche pas la perfection, on améliore

## Début de review

Dis-moi quel code tu veux que je review, ou je peux regarder les derniers changements (git diff).

---

**Code à reviewer** : $ARGUMENTS
