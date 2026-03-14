# Flux Print Shop Scheduling System

Ez egy nyomdaipari ütemező rendszer (Flux Scheduler) monorepo-ja.

## Projekt struktúra

```
ewlin/
├── services/php-api/     # PHP/Symfony backend (git submodule)
├── packages/types/       # @flux/types TypeScript csomag (git submodule)
├── packages/validator/   # @flux/schedule-validator (git submodule)
├── apps/web/             # React frontend
└── docs/                 # Dokumentáció
    ├── roadmap/          # Release roadmap
    ├── releases/         # Release dokumentumok
    ├── architecture/     # ADR-ek, stratégiák
    └── domain-model/     # Üzleti szabályok, vocabulary
```

## Language

Always communicate with the user in English. Code, commit messages, and documentation are also in English.

## Release workflow

Amikor release implementálást kérek, **mindig** kövesd ezt a workflow-t:

### 1. Release dokumentum elkészítése
- Ellenőrizd, hogy létezik-e: `docs/releases/v{VERSION}-{name}.md`
- Ha nem, készítsd el a `docs/releases/_TEMPLATE.md` alapján
- Töltsd ki: scope, prerequisites, feature checklist, testing requirements

### 2. Jóváhagyás kérése
- Mutasd be a release dokumentumot
- **VÁRD MEG** a user explicit jóváhagyását mielőtt továbblépnél

### 3. Implementálás
- Használj TodoWrite-ot a feladatok követésére
- Kövesd a feature checklist-et
- Írj unit és integration teszteket
- Futtass PHPStan-t (level 8)
- Futtass minden tesztet

### 4. Jóváhagyás kérése
- Mutasd be az implementáció összefoglalóját
- Teszteredmények, PHPStan eredmények
- **VÁRD MEG** a user explicit jóváhagyását

### 5. Dokumentumok aktualizálása
- `docs/roadmap/release-roadmap.md` - jelöld ✅-ként
- `docs/releases/v{VERSION}-*.md` - státusz: Released, checkboxok ✅
- `services/php-api/CHANGELOG.md` - új verzió hozzáadása

### 6. Git műveletek (PHP API - PR workflow)

**FONTOS: Mindig PR-on keresztül merge-elj, SOHA ne commitolj közvetlenül main-re!**

```bash
# PHP API repo (services/php-api/)

# 1. Feature branch létrehozása
git checkout -b feature/v{VERSION}-{kebab-case-name}

# 2. Commit és push
git add -A
git commit -m "feat: {Short description}"
git push -u origin feature/v{VERSION}-{kebab-case-name}

# 3. PR létrehozása
gh pr create --title "v{VERSION} - {Title}" --body "..."

# 4. VÁRD MEG a CI ZÖLD STÁTUSZT és a PR MERGE-ÖT!

# 5. Merge után: checkout main és pull
git checkout main
git pull origin main

# 6. Tag és release létrehozása
git tag -a v{VERSION} -m "v{VERSION} - {Title}"
git push origin v{VERSION}
gh release create v{VERSION} --title "v{VERSION} - {Title}" --notes "..."
```

### 7. Git műveletek (Monorepo - dokumentáció)
```bash
# Monorepo (ewlin/) - ez mehet közvetlenül main-re
git add docs/ services/php-api
git commit -m "docs: Update for v{VERSION} release"
git push origin main
```

### 8. CI ellenőrzés
- Ellenőrizd a GitHub Actions státuszát
- Ha fail, javítsd és ismételd a git műveleteket

## Commit üzenet formátum

```
v{VERSION} - {Short Title}

{Description}

Features:
- Feature 1
- Feature 2

Technical:
- Technical change 1

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

## Fontos fájlok

| Fájl | Leírás |
|------|--------|
| `docs/roadmap/release-roadmap.md` | Teljes release roadmap |
| `docs/releases/_TEMPLATE.md` | Release dokumentum sablon |
| `docs/architecture/git-release-strategy.md` | Git/verzió stratégia |
| `docs/domain-model/business-rules.md` | Üzleti szabályok (BR-*) |

## PHP API specifikus

- **PHPStan level 8** kötelező
- **PHPUnit** tesztek kötelezőek
- Symfony 7 + Doctrine ORM
- OpenAPI dokumentáció (Swagger UI: /api/doc)

## Playwright tesztek — SZIGORÚ SZABÁLYOK

### 1. SOHA ne futtass Playwright tesztet engedély nélkül
- Playwright tesztet (`npx playwright test`, `npx playwright show-trace`, stb.) **CSAK akkor futtathatsz, ha a user EXPLICIT, egyértelmű engedélyt ad.**
- "Javítsd meg a teszteket" — ez NEM engedély a futtatásra.
- Ha teszteredményre van szükséged, **kérdezd meg a usert**, hogy futtassa és adja át az outputot.

### 2. MINDIG olvasd el az actual error output-ot ELŐSZÖR
- Mielőtt bármilyen változtatást csinálsz failing teszteknél, **olvasd el a tényleges hibaüzenetet**.
- A `test-results/` könyvtárban minden failing teszthez van `error-context.md` — olvasd el.
- A user által átadott test output-ot (terminál, fájl) olvasd el, mielőtt diagnózist állítasz fel.
- **Feltevések alapján dolgozni tilos.** Minden változtatásnak konkrét, olvasott hibaüzeneten kell alapulnia.
