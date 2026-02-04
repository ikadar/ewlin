---
description: Implementálj egy dokumentációs release-t fájlonkénti jóváhagyással
---

# Documentation Release Implementation: $ARGUMENTS

Implementáld a megadott dokumentációs release-t az alábbi workflow szerint.

**Target branch:** `ux-ui-development`

---

## Workflow lépések

### 1. FÁZIS: Változás-leírás készítése

A dokumentáció-frissítés alapja a **pontos változás-leírás**: mi változott a kódban, milyen új fogalmak, entitások, szabályok jöttek létre.

1. **Olvasd be a releváns forráskódot alaposan:**
   - Típusdefiníciók (`packages/types/src/`)
   - Validátor logika (`packages/validator/src/`)
   - Frontend kód (`apps/web/src/`) — komponensek, utils, hooks
   - Tesztek — ezek dokumentálják az elvárt viselkedést
   - **Cél:** Pontos, kóddal alátámasztott megértés, nem feltételezés

2. **Készíts változás-leírást (Change Description):**
   A release dokumentum `## Change Description` szekciójába írd le:
   - **Milyen entitások/típusok jöttek létre vagy változtak** (mezők, kapcsolatok)
   - **Milyen üzleti szabályok érvényesek** (a kód és tesztek alapján)
   - **Milyen viselkedés változott** (validáció, UI, workflow)
   - **Pontos hivatkozások a forráskódra** (fájl + releváns részlet)

   Ez a változás-leírás a **single source of truth** a dokumentáció-frissítéshez.

3. **STOP - Mutasd be a változás-leírást és VÁRD MEG a jóváhagyást!**

---

### 2. FÁZIS: Release dokumentum

Csak a jóváhagyás után folytasd!

1. **Release dokumentum ellenőrzése:**
   - Ellenőrizd, hogy létezik-e: `docs/releases/v{VERSION}-{name}.md`
   - Ha nem létezik, készítsd el a `docs/releases/_TEMPLATE.md` alapján
   - Ha létezik, egészítsd ki a jóváhagyott változás-leírással

2. **Olvasd be az összes frissítendő dokumentumot:**
   - A release dokumentum Feature Checklist szekciója meghatározza a fájlokat
   - Olvasd be mindegyiket, hogy megértsd a jelenlegi tartalmat

3. **STOP - Mutasd be a release dokumentumot és VÁRD MEG a jóváhagyást!**

---

### 3. FÁZIS: Fájlonkénti implementálás

Csak a jóváhagyás után folytasd!

1. **Feature branch létrehozása:**
   ```bash
   cd /Users/istvan/Code/ewlin
   git checkout ux-ui-development && git pull origin ux-ui-development
   git checkout -b feature/v{VERSION}-{short-name}
   ```

2. **Minden dokumentumra ismételd:**

   ```
   LOOP (fájlonként):
     a) OLVASD BE a releváns forráskódot:
        - A változás-leírás alapján azonosítsd, milyen kódrészletek
          relevánsak ehhez a dokumentumhoz
        - Olvasd be a típusdefiníciókat, validátor logikát, teszteket
        - Győződj meg róla, hogy amit írsz, az KONZISZTENS a kóddal

     b) MUTASD BE a tervezett változtatásokat:
        - Milyen szekciók módosulnak
        - Milyen szekciók jönnek létre
        - A változtatások tartalmi összefoglalója
        - Ha a kód és a jelenlegi dokumentáció között eltérést találtál,
          jelezd külön
        - NE mutasd a teljes szöveget, csak a lényeget

     c) VÁRD MEG a jóváhagyást:
        - Ha módosítást kér → vissza a b) pontra
        - Ha jóváhagyja → folytasd a d) ponttal

     d) VÉGEZD EL a változtatásokat a fájlban

     e) Folytasd a következő fájllal
   ```

3. **A dokumentumok sorrendje a release dokumentum Feature Checklist szekciójából jön.**

---

### 4. FÁZIS: Minőségellenőrzés

1. **Kód-dokumentáció konzisztencia:**
   - Olvasd végig a frissített dokumentumokat
   - Ellenőrizd, hogy minden állítás alátámasztható a forráskóddal
   - Ha kétséges, olvasd újra a kódot

2. **Cross-reference konzisztencia:**
   - Ellenőrizd, hogy a fogalmak konzisztensek-e az összes frissített dokumentumban
   - Ellenőrizd, hogy a hivatkozások (BR-*, DM-*, WF-*) érvényesek-e
   - Ellenőrizd, hogy nem maradt-e elavult szöveg (pl. régi fogalmak, megszűnt mezők)

3. **STOP - Mutasd be az összefoglalót:**
   - Módosított fájlok listája
   - Változtatások összefoglalója fájlonként
   - Talált inkonzisztenciák (ha vannak)
   - **VÁRD MEG a jóváhagyást!**

---

### 5. FÁZIS: Commit és merge

Csak a jóváhagyás után folytasd!

1. **Commit:**
   ```bash
   git add docs/
   git commit -m "$(cat <<'EOF'
   docs: v{VERSION} - {Title}

   {Description}

   Updated documents:
   - {file1} — {change summary}
   - {file2} — {change summary}

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
   EOF
   )"
   ```

2. **Push és merge:**
   ```bash
   git push -u origin feature/v{VERSION}-{short-name}
   git checkout ux-ui-development
   git pull origin ux-ui-development
   git merge feature/v{VERSION}-{short-name}
   git push origin ux-ui-development
   ```

3. **Feature branch cleanup:**
   ```bash
   git branch -d feature/v{VERSION}-{short-name}
   git push origin --delete feature/v{VERSION}-{short-name}
   ```

---

### 6. FÁZIS: Tag és release

1. **Git tag:**
   ```bash
   git tag -a v{VERSION} -m "v{VERSION} - {Title}"
   git push origin v{VERSION}
   ```

2. **GitHub release:**
   ```bash
   gh release create v{VERSION} \
     --target ux-ui-development \
     --title "v{VERSION} - {Title}" \
     --notes "$(cat <<'EOF'
   ## Summary
   {Brief description}

   ## Updated Documents
   - {file1} — {change summary}
   - {file2} — {change summary}

   ## Notes
   - Documentation-only release (no code changes)
   - Released on ux-ui-development branch
   EOF
   )"
   ```

---

### 7. FÁZIS: Roadmap frissítés

1. **Frissítsd:**
   - `docs/roadmap/release-roadmap.md` — jelöld ✅-ként
   - `docs/releases/v{VERSION}-*.md`:
     - Status: 🟢 Released
     - Feature checklist: minden ✅
     - Definition of Done: minden ✅

2. **Commit:**
   ```bash
   git add docs/
   git commit -m "docs: Mark v{VERSION} as released"
   git push origin ux-ui-development
   ```

---

## Fontos szabályok

- **SOHA** ne lépj tovább jóváhagyás nélkül az 1., 2., 3. és 4. fázis után
- **MINDIG** olvasd be a forráskódot mielőtt dokumentációt írsz — a kód az igazság forrása
- **MINDIG** fájlonként mutasd be a tervezett változtatásokat
- **MINDIG** várd meg a jóváhagyást mielőtt szerkesztesz
- **MINDIG** használj feature branch-et
- **MINDIG** jelezd, ha a kód és a dokumentáció között eltérést találsz
- A dokumentum sorrendje a release doc Feature Checklist szekciójából jön
- A változás-leírás (Change Description) a single source of truth
- Commit üzenetek angolul, kommunikáció magyarul
