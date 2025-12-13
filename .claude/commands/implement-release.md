---
description: Implementálj egy release-t a standard workflow szerint
---

# Release implementálás: $ARGUMENTS

Implementáld a megadott release-t az alábbi **kötelező** workflow szerint.

## Workflow lépések

### 1. FÁZIS: Előkészítés és specifikáció

1. **Olvasd be az összes releváns specifikációs dokumentumot:**
   - `docs/domain-model/` - minden fájl (üzleti szabályok, vocabulary)
   - `docs/architecture/` - minden fájl (ADR-ek, stratégiák, interface contracts)
   - `docs/requirements/` - minden fájl (API drafts, DSL spec)

2. **Release dokumentum ellenőrzése:**
   - Ellenőrizd, hogy létezik-e: `docs/releases/v{VERSION}-{name}.md`
   - Ha **nem létezik**:
     - Olvasd be: `docs/releases/_TEMPLATE.md`
     - Olvasd be: `docs/roadmap/release-roadmap.md` (scope megértéséhez)
     - Készítsd el a release dokumentumot
   - Ha **létezik**, olvasd be és értsd meg a scope-ot

3. **STOP - Mutasd be a release dokumentumot és VÁRD MEG a jóváhagyást!**

---

### 2. FÁZIS: Feature branch és implementálás

Csak a jóváhagyás után folytasd!

1. **Feature branch létrehozása minden érintett repo-ban:**
   ```bash
   # PHP API (ha érintett)
   cd services/php-api
   git checkout main && git pull origin main
   git checkout -b feature/v{VERSION}-{short-name}

   # Types package (ha érintett)
   cd packages/types
   git checkout main && git pull origin main
   git checkout -b feature/v{VERSION}-{short-name}

   # Validator package (ha érintett)
   cd packages/validator
   git checkout main && git pull origin main
   git checkout -b feature/v{VERSION}-{short-name}
   ```

2. **Hozz létre TodoWrite listát** a feature checklist alapján

3. **Implementáld minden feature-t:**
   - Value object-ek
   - DTO-k
   - Service metódusok
   - Controller action-ök
   - Unit tesztek
   - Integration tesztek

4. **Minőségellenőrzés:**
   ```bash
   # PHP API könyvtárban (services/php-api/)
   ./vendor/bin/phpunit
   php -d memory_limit=512M ./vendor/bin/phpstan analyse

   # TypeScript packages (ha érintett)
   pnpm build
   pnpm test
   ```

5. **STOP - Mutasd be az implementáció összefoglalóját:**
   - Létrehozott/módosított fájlok
   - Teszteredmények
   - PHPStan eredmények
   - **VÁRD MEG a jóváhagyást!**

---

### 3. FÁZIS: Pull Request-ek létrehozása

Csak a jóváhagyás után folytasd!

1. **Commitold a változtatásokat** minden érintett repo-ban:
   ```bash
   git add -A
   git commit -m "v{VERSION} - {Title}..."
   git push -u origin feature/v{VERSION}-{short-name}
   ```

2. **Hozz létre PR-t minden érintett repo-ban:**
   ```bash
   gh pr create --title "v{VERSION} - {Title}" --body "..."
   ```

3. **Mutasd be a PR URL-eket** a usernek

4. **STOP - VÁRD MEG amíg a user manuálisan review-olja és mergeli a PR-eket!**

---

### 4. FÁZIS: Release és dokumentáció

Csak a PR-ek MERGE-elése után folytasd!

1. **Frissítsd a lokális main branch-eket:**
   ```bash
   # Minden érintett repo-ban
   git checkout main && git pull origin main
   ```

2. **Hozz létre release-t minden érintett repo-ban:**
   ```bash
   # PHP API (ha érintett)
   cd services/php-api
   git tag -a v{VERSION} -m "v{VERSION} - {Title}"
   git push origin v{VERSION}
   gh release create v{VERSION} --title "v{VERSION} - {Title}" --notes "..."

   # Types package (ha érintett)
   cd packages/types
   git tag -a v{VERSION} -m "v{VERSION} - {Title}"
   git push origin v{VERSION}
   gh release create v{VERSION} --title "v{VERSION} - {Title}" --notes "..."

   # Validator package (ha érintett)
   cd packages/validator
   git tag -a v{VERSION} -m "v{VERSION} - {Title}"
   git push origin v{VERSION}
   gh release create v{VERSION} --title "v{VERSION} - {Title}" --notes "..."
   ```

3. **Dokumentumok frissítése (monorepo):**
   - `docs/roadmap/release-roadmap.md` - jelöld ✅-ként a release-t
   - `docs/releases/v{VERSION}-*.md`:
     - Status: ✅ Released
     - Release Date: aktuális dátum
     - Feature checklist: minden ✅
     - Definition of Done: minden ✅
   - `services/php-api/CHANGELOG.md` - új verzió section (ha PHP API érintett)

4. **Git műveletek (Monorepo):**
   ```bash
   cd /Users/istvan/Code/ewlin
   git add docs/ services/ packages/
   git commit -m "docs: Update for v{VERSION} release"
   git push origin main
   ```

5. **CI ellenőrzés:**
   - Ellenőrizd az Actions státuszát minden érintett repo-ban
   - Ha fail, javítsd és ismételd

---

## Fontos szabályok

- **SOHA** ne lépj tovább jóváhagyás nélkül az 1., 2. és 3. fázis után
- **MINDIG** olvass be minden specifikációs dokumentumot az 1. fázisban
- **MINDIG** használj feature branch-et, SOHA ne commitolj közvetlenül main-re
- **MINDIG** használj TodoWrite-ot a haladás követésére
- **MINDIG** futtass teszteket és PHPStan-t
- **MINDIG** hozz létre PR-t és VÁRD MEG a manuális review-t és merge-t
- Commit üzenetek angolul, kommunikáció magyarul

## Érintett repository-k

| Repo | Mikor érintett |
|------|----------------|
| `services/php-api` | Backend feature, API endpoint, entity |
| `packages/types` | Új/módosított TypeScript típusok |
| `packages/validator` | Validációs szabály változás |
| `apps/web` | Frontend feature |
