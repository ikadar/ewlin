# Tutoriel : Travailler sur le projet Flux Scheduler

## 1. Structure du projet

```
ewlin/
├── services/php-api/     # Backend Symfony (submodule git)
├── packages/types/       # Types TypeScript partagés (submodule)
├── packages/validator/   # Validation des schedules (submodule)
├── apps/web/             # Frontend React
└── docs/
    ├── releases/         # Documentation de chaque release
    ├── roadmap/          # Planning général
    ├── domain-model/     # Règles métier
    ├── architecture/     # Décisions techniques (ADR)
    └── ux-ui/            # Spécifications UI
```

## 2. Les 3 skills disponibles

| Skill | Usage |
|-------|-------|
| `/implement-release` | Release backend (PHP API, packages) |
| `/implement-ui-release` | Release frontend sur `ux-ui-development` |
| `/implement-ui-release-from-requirement` | Release UI à partir d'un requirement documenté |

## 3. Workflow standard d'une release

### Étape 1 : Préparation
1. Vérifier si le doc de release existe dans `docs/releases/v{VERSION}-{nom}.md`
2. Sinon, créer à partir de `docs/releases/_TEMPLATE.md`
3. **Attendre ton approbation** avant d'implémenter

### Étape 2 : Implémentation
1. Créer une feature branch : `feature/v{VERSION}-{nom}`
2. Coder en suivant la checklist du doc de release
3. Écrire les tests (PHPUnit, Vitest, Playwright)
4. Vérifier la qualité : PHPStan level 8, ESLint
5. **Montrer les résultats et attendre ton approbation**

### Étape 3 : Merge
1. Créer une PR (jamais de commit direct sur main)
2. Attendre que la CI passe et que la PR soit mergée
3. Tag + GitHub Release

### Étape 4 : Documentation
1. Mettre à jour `docs/roadmap/release-roadmap.md` (ajouter ✅)
2. Mettre le status "Released" dans le doc de release
3. Commit des docs sur le monorepo

## 4. Spécificités UI (branche `ux-ui-development`)

Pour le frontend, on travaille sur une **branche séparée** `ux-ui-development` (pas main).

**Workflow UI :**
```bash
git checkout ux-ui-development
git pull origin ux-ui-development
git checkout -b feature/v0.3.54-ma-feature

# ... développement ...

git push -u origin feature/v0.3.54-ma-feature
# Merger dans ux-ui-development (pas main)
gh release create v0.3.54 --target ux-ui-development
```

## 5. Conventions

### Format de commit
```
feat(component): Short description

Longer description if needed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Versioning actuel
- **v0.3.x** = Frontend (UI) - actuellement à v0.3.53
- La prochaine release UI serait **v0.3.54**

## 6. Comment lancer une release ?

**Option simple :** Dis-moi ce que tu veux faire et j'utiliserai le skill approprié.

**Exemples :**
- "Implémente le requirement REQ-04" → `/implement-ui-release-from-requirement`
- "Ajoute un bouton de zoom" → `/implement-ui-release`
- "Ajoute un endpoint API" → `/implement-release`

## 7. Fichiers clés à connaître

| Fichier | Description |
|---------|-------------|
| `docs/roadmap/release-roadmap.md` | Liste de toutes les releases planifiées/faites |
| `docs/releases/_TEMPLATE.md` | Template pour créer un nouveau doc de release |
| `docs/ux-ui/tmp/backlog.md` | Backlog des features UI à faire |
| `apps/web/src/mock/testFixtures.ts` | Fixtures de test pour le frontend |
