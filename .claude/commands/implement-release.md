---
description: Implementálj egy release-t a standard workflow szerint
---

# Release implementálás: $ARGUMENTS

Implementáld a megadott release-t az alábbi **kötelező** workflow szerint.

## Workflow lépések

### 1. FÁZIS: Release dokumentum

1. Ellenőrizd, hogy létezik-e a release dokumentum:
   - `docs/releases/v{VERSION}-{name}.md`

2. Ha **nem létezik**:
   - Olvasd be: `docs/releases/_TEMPLATE.md`
   - Olvasd be: `docs/roadmap/release-roadmap.md` (scope megértéséhez)
   - Készítsd el a release dokumentumot

3. Ha **létezik**, olvasd be és értsd meg a scope-ot

4. **STOP - Mutasd be a release dokumentumot és VÁRD MEG a jóváhagyást!**

---

### 2. FÁZIS: Implementálás

Csak a jóváhagyás után folytasd!

1. Hozz létre TodoWrite listát a feature checklist alapján
2. Implementáld minden feature-t:
   - Value object-ek
   - DTO-k
   - Service metódusok
   - Controller action-ök
   - Unit tesztek
   - Integration tesztek

3. Minőségellenőrzés:
   ```bash
   # PHP API könyvtárban (services/php-api/)
   ./vendor/bin/phpunit
   php -d memory_limit=512M ./vendor/bin/phpstan analyse
   ```

4. **STOP - Mutasd be az implementáció összefoglalóját:**
   - Létrehozott/módosított fájlok
   - Teszteredmények
   - PHPStan eredmények
   - **VÁRD MEG a jóváhagyást!**

---

### 3. FÁZIS: Dokumentumok és release

Csak a jóváhagyás után folytasd!

1. **Dokumentumok frissítése:**
   - `docs/roadmap/release-roadmap.md` - jelöld ✅-ként a release-t
   - `docs/releases/v{VERSION}-*.md`:
     - Status: ✅ Released
     - Release Date: aktuális dátum
     - Feature checklist: minden ✅
     - Definition of Done: minden ✅
   - `services/php-api/CHANGELOG.md` - új verzió section

2. **Git műveletek (PHP API):**
   ```bash
   cd services/php-api
   git add -A
   git commit -m "v{VERSION} - {Title}..."
   git push origin main
   git tag -a v{VERSION} -m "v{VERSION} - {Title}"
   git push origin v{VERSION}
   gh release create v{VERSION} --title "..." --notes "..."
   ```

3. **Git műveletek (Monorepo):**
   ```bash
   cd /Users/istvan/Code/ewlin
   git add docs/ services/php-api
   git commit -m "docs: Update for v{VERSION} release"
   git push origin main
   ```

4. **CI ellenőrzés:**
   - Ellenőrizd: https://github.com/ikadar/ewlin-php-api/actions
   - Ha fail, javítsd és ismételd

---

## Fontos szabályok

- **SOHA** ne lépj tovább jóváhagyás nélkül az 1. és 2. fázis után
- **MINDIG** használj TodoWrite-ot a haladás követésére
- **MINDIG** futtass teszteket és PHPStan-t
- Commit üzenetek angolul, kommunikáció magyarul
