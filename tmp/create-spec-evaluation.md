Ez az értékelés a `/create-spec` parancs jelenlegi működését vizsgálja **kontrollált döntéshozatal** szempontjából, különös tekintettel arra, hogy a Claude Code a futás során **tisztázó kérdéseket tesz fel**, és hiányzó információkat kér be.

A megközelítés továbbra is erős és ígéretes, de csak akkor fogja elérni a kitűzött célt – vagyis azt, hogy az LLM **ne hozzon meg rejtett stratégiai vagy taktikai döntéseket** –, ha a tisztázó mechanizmus **formálisan be van építve** a specifikációs rendszerbe.

---

## 1) Kulcsfelismerés: a tisztázó kérdés önmagában nem kontroll
Fontos új felismerés, hogy a Claude Code már most is kérdez. Ez azonban **önmagában nem garancia** arra, hogy nem történik implicit tervezés.

A tisztázó kérdések két alapvetően különböző típusra bonthatók:

### 1.1 Faktum-tisztázás (megengedett)
Olyan kérdések, amelyek **objektív információt** kérnek be, például:
- melyik user role érintett,
- mely mezők kötelezők,
- pontos szöveg, hibaüzenet, határérték.

Ezek **nem hordoznak tervezési döntést**, és közvetlenül beépíthetők a specifikációba.

### 1.2 Döntés-tisztázás (kritikus)
Olyan kérdések, amelyek **alternatívák közti választást** igényelnek, például:
- sync vagy async kommunikáció,
- egy vagy több bounded context,
- aggregate határ meghúzása,
- consistency modell,
- integrációs és failure szemantika.

Ezek **nem puszta hiányzó adatok**, hanem **tervezési döntések**.  
Ha ezek nincsenek explicit módon rögzítve, az LLM óhatatlanul „kitölti az űrt”.

---

## 2) Új kötelező lépés: Ambiguity Discovery & Decision Capture
A `/create-spec` workflow implicit módon már tartalmaz egy „Step 0”-t, amit explicit szabállyá kell emelni:

```
Step 0: Ambiguity discovery & decision capture
Step 1: Analyze & Propose
Step 2: Generate
```

Ebben a lépésben:
- az LLM **kifejezetten listázza** a hiányzó információkat,
- **külön választja** a faktumhiányt és a döntéshiányt,
- döntéshiány esetén **nem javasol megoldást**, csak alternatívákat nevez meg.

Spec-generálás **nem indulhat el**, amíg minden döntési kérdés le nincs zárva.

---

## 3) Döntési minimálkészlet (Decision Grammar) – továbbra is kritikus
A korábbi értékelés egyik fő megállapítása továbbra is érvényes, de pontosítva:

Nem az a probléma, hogy a command US/AC/BR/API/UX dokumentumokban gondolkodik,  
hanem az, hogy **nincs explicit, kötelező döntési mag**, amelyet minden Category A változtatásnál rögzíteni kell.

Ez a minimálkészlet tipikusan tartalmazza:
- bounded context / ownership,
- aggregate boundary és invariánsok,
- konzisztenciaelv (strong vs eventual),
- integrációs szemantika (sync/async, retry, idempotency),
- adat-ownership és source of truth,
- releváns non-functional elvárások (security, audit, reliability).

Ezek nélkül a „spec → kód” továbbra is **LLM-implicit tervezést** eredményez.

---

## 4) Kategorizálás (A/B/C) – pontosítás
A kategorizálás hasznos, de fontos pontosítás:

- Sok, elsőre „technikai”-nak tűnő kérdés valójában **domain-döntés** (pl. audit, security, reliability).
- Ezeket **nem szabad automatikusan Category C-be sorolni** és kivonni a spec-first folyamatból.
- Category C csak azokra a változásokra alkalmazható, amelyek **bizonyítottan nem érintenek domain-viselkedést**.

---

## 5) Dokumentumok szerepe: deriváltak, nem döntési források
A korábbi kritika itt finomításra szorul.

A probléma nem az, hogy US/AC/API/UX készül, hanem az, ha ezek **döntési forrássá válnak**.

A helyes irány:
- a **döntési specifikáció** (constraints, boundaries, invariánsok) az elsődleges,
- US/AC/API/UX **származtatott nézetek**,
- a traceability mindig a döntési mag felé mutat.

---

## 6) Ambiguities Gate – új, explicit STOP pont
A meglévő két STOP (proposal approval, save approval) mellé kötelező egy harmadik:

> **STOP: unresolved ambiguities**

Ha bármely stratégiai vagy taktikai kérdés nyitva van:
- nincs generálás,
- nincs „best practice” kitöltés,
- nincs implicit default.

Ez az a pont, ahol a rendszer ténylegesen megakadályozza, hogy az LLM „architektként” viselkedjen.

---

## 7) ID-k és dokumentumgráf – változatlan, de hangsúlyos
Az ID-kezeléssel kapcsolatos korábbi megállapítások továbbra is érvényesek:
- ID sosem változik,
- refactor = új döntés + régi döntés lezárása,
- deprecation helye és státusza explicit.

Ez nem adminisztráció, hanem **reprodukálhatósági garancia**.

---

## Összegzés – frissített ítélet
A `/create-spec` parancs jó alap egy **spec-first, AI-assisted rendszerhez**, és a tisztázó kérdések megléte kifejezetten erős UX-alap.

A kritikus különbség azonban ez:

> Nem elég, hogy az LLM kérdez.  
> A rendszernek **kényszerítenie kell**, hogy a kérdésekből **formális, visszakereshető döntések** szülessenek.

Ha a tisztázó kérdések:
- faktumot → specifikációs adatot,
- döntést → döntési rekordot

eredményeznek, akkor a workflow valóban elmozdul a  
**„LLM-assisted coding” → „design-constraint–driven generation”** irányába.
