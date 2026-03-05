# Tableau de Flux — Specification Q&A

**Date:** 2026-03-02

Kérdések és válaszok a specifikáció értelmezéséhez, az implementáció megkezdése előtt feltárva.

---

## 1. Integráció a meglévő alkalmazással

**K1.1** A spec 3.1-ben azt írja, hogy a sidebar "az ERP shell része, outside of scope." A meglévő appban viszont már van egy Sidebar (LayoutGrid, Calendar, Settings, User). Melyik érvényes?

> **V:** A meglévő Sidebar-t kell használni.

---

**K1.2** Melyik route-on él ez az oldal?

> **V:** `/flux`

---

**K1.3** A "Nouveau job" gomb (`Alt+N`) mit csinál pontosan? A meglévő JCF modalt nyitja meg, vagy a `/job/new` route-ra navigál?

> **V:** A `/job/new` route-ra navigál.

---

## 2. Táblázat — belső ellentmondás

**K2.1** Az oszloplista (3.6) azt mutatja, hogy az expand toggle egy **önálló 24px-es oszlop** (#1), a frozen left zónában. Ugyanakkor a 3.7-es szekció azt írja: *"The ID cell also contains the expand/collapse toggle."* Melyik a helyes?

> **V (mockup.html alapján):** Az expand toggle **önálló oszlop** (`w-6` = 24px, `sticky left-0`). Az ID oszlop mellette áll (`sticky left-6`). A 3.7-es szekció téved — a toggle nem az ID cellában van.

---

**K2.2** A 3.6 szerint 4 frozen-left oszlop van (expand + ID + Client + Designation), a 3.7 viszont "three columns"-t ír. Melyik helyes?

> **V (mockup.html alapján):** **4 frozen-left oszlop** van: expand (`sticky left-0`), ID (`sticky left-6`), Client (`sticky left-[5.5rem]`), Designation (`sticky left-[14.5rem]`). A 3.7 "three columns" megjegyzése téves.

---

## 3. Station indikátorok — adatmodell

**K3.1** A ring+dot indikátor 1–99% közötti értéket jelenít meg. Honnan jön ez a százalék?

> **V:** Halasztva — later discussion.

---

**K3.2** Mikor "late" egy station? A spec felsorolja mint állapotot, de nem definiálja a feltételt.

> **V:** A `late` állapot nem station-szintű, hanem **task-assignment szintű kalkuláció** a backend oldalon (`FluxElementResponse::computeTaskState()`):
> - `TaskAssignment.scheduledEnd < now` ÉS `isCompleted = false` → `'late'`
> - A backend kiszámolja és `state: 'late'`-ként küldi a `/flux/jobs` válaszban.
> - A frontend (`FluxStationIndicator`) már kezeli: piros ring+dot indikátor.
> - **Implementálva:** v0.5.20 (backend), v0.5.18 (frontend indicator).

---

## 4. Tab count badge-ek

**K4.1** A tab count-ok a keresőmező szűrésétől függetlenül számolódnak, vagy a keresés szűkíti a count-ot is?

> **V:** A keresés szűkíti a count-ot is. Mindkét feltételnek (tab szűrő + keresés) teljesülnie kell, a count a kombinált eredményt tükrözi.

---

## 5. "Parti" oszlop interaktivitása

**K5.1** A "Parti" oszlopnál "toggle icon"-t említ a spec. Ez kattintással váltható? Ha igen, mi történik — dátumválasztó jelenik meg, vagy automatikusan a mai dátumot kapja?

> **V:** Halasztva — later discussion.

---

## 6. Actions oszlop

**K6.1** Delete (kuka ikon): Van megerősítő dialog, vagy azonnal töröl?

> **V:** Van megerősítő dialog.

---

**K6.2** Edit (mappa ikon): Mit csinál?

> **V:** A meglévő JCF-et nyitja meg az adott job adataival.

---

## 7. Multi-element kezdőállapot

**K7.1** Az oldalra érkezéskor a multi-element sorok össze vannak húzva vagy ki vannak nyitva?

> **V:** Össze vannak húzva (collapsed) alapértelmezetten.

---

## 8. Sub-sorok interaktivitása

**K8.1** A sub-sorokon a prerequisite badge-ek szintén interaktív listbox-ok (módosíthatók), vagy csak olvasható megjelenítők? Ha módosítható és egy sub-sor státusza megváltozik, a parent sor aggregált worst értéke újraszámolódik?

> **V:** Interaktív listbox-ok. Ha egy sub-sor státusza megváltozik, a parent aggregált worst értéke azonnal újraszámolódik.

---

## 9. Oszlopok rendezése

**K9.1** Az oldalra érkezéskor mi az alapértelmezett rendezési sorrend?

> **V:** ID szerint növekvő.

---

**K9.2** A station oszlopok (Off., Mass., stb.) is rendezhetők? Ha igen, mi alapján?

> **V:** Igen, rendezhetők. A spec 3.6 általánosan kimondja: "Clicking a column header sorts the table by that column." Az algoritmus:
> 1. Minden jobhoz az adott kategória state-jét összegyűjtjük az összes elemből.
> 2. A legrosszabb (worst) state alapján rendezünk: `late(0) > in-progress(1) > planned(2) > done(3) > empty(4)`.
> 3. Multi-element jobokra ugyanez a worst-aggregation, mint a prerequisite oszlopoknál.
> - **Implementálva:** v0.5.24 (tervezett).

---

**K9.3** Multi-element parent sorok rendezésekor mi az összehasonítási alap?

> **V:** Az aggregált worst érték alapján.

---

## 10. Vizuális részletek

**K10.1** A "Designation" oszlop szélessége "20%"-ban van megadva. Ez az egész tábla szélességének 20%-a, vagy a görgethetó középső rész 20%-a?

> **V:** Az egész tábla szélességének 20%-a (a frozen oszlopokat is beleértve). A mockup colgroup-jában `style="width: 20%"` van a `<table>` elem szélességéhez képest.

---

**K10.2** Van-e sor hover kiemelés (row hover state)?

> **V:** Nincs.

---

## 11. URL perzisztencia

**K11.1** A spec `#tab=papier` hash-alapú megközelítést ír le. Mi az implementálandó megoldás?

> **V:** React Router nested routes. Minden tab saját route-on él:
> - `/flux` → Tous (default)
> - `/flux/prepresse` → A faire prepresse
> - `/flux/papier` → Cdes papier
> - `/flux/formes` → Cdes formes
> - `/flux/plaques` → Plaques a produire

---

## Összefoglaló — halasztott kérdések

A következő kérdések válasza még nyitott, implementáció közben vagy előtt kell tisztázni:

| Kérdés | Téma |
|--------|------|
| K3.1 | Station progress % forrása (API mező?) |
| ~~K3.2~~ | ~~"Late" állapot definíciója~~ — **Lezárva**: backend kalkuláció (`scheduledEnd < now`), már implementálva |
| K5.1 | Parti toggle interaktivitás + dátumkezelés |
| ~~K9.2~~ | ~~Station oszlopok rendezhetősége~~ — **Lezárva**: worst-state severity ranking, implementálva v0.5.24-ben |
