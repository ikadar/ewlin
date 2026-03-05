# Backlog — 2026 March

## Scheduler nézet

| # | Feladat                                      | Leírás | Státusz |
|---|----------------------------------------------|--------|---------|
| S1 | *Scrollbar-ok teljes elrejtése               | Scheduler view-ban minden scrollbar rejtett (scroll működik, de vizuálisan láthatatlan) | |
| S2 | ESC → close job details                      | Job kijelölve + ESC: job details panel bezárása (nem area select) | |
| S3 | Scheduler ikon: `CalendarDays`               | Sidebar navigáció ikon csere (Lucide) | |
| S4 | *Area selection eltávolítása                 | Teljes feature eltávolítás | |
| S5 | -Tile fejléc: job, element, client           | Grid tile-on megjelenik: job reference, element name, client | |
| S6 | Task list: completed látható + toggleable    | Completed task-ok láthatók és toggle-ölhetők a task listában | |
| S7 | -Bug: L-00003 filmeuse element name hiányzik | Tirage módban nincs element name | |
| S8 | Compact: 4, 8, 24, 48, 72 órás időtartamok   | Compact funkció különböző időtávokra (48h, 72h hozzáadása) | |
| S9 | Bug: prereq dropdown eltolja a task bar-t    | Layout issue prereq dropdown kinyitásakor | |

## Placement / Quick Place

| # | Feladat | Leírás | Státusz |
|---|---------|--------|---------|
| P1 | Quick place: scroll to deadline | Quick placement módba lépéskor scroll a job workshopExitDate-jéhez | |
| P2 | Validáció: scheduledEnd < deadline | Placement-nél a task vége legyen a deadline előtt | |

## JCF (Job Creation Form)

| # | Feladat                             | Leírás                                                   | Státusz |
|---|-------------------------------------|----------------------------------------------------------|---------|
| J1 | Naptár kattintható terület növelése | JCF dátumválasztón túl kicsi a kattintható area          | |
| J2 | JCF bezárás → job deselect          | Modal bezárásakor a kijelölt job NE legyen deselect-álva | |
| J3 | *JCF ST: dinamikus adatok           | Sous-traitance szekció API-ból jövő adatokkal            | |

## Flux dashboard

| # | Feladat                                  | Leírás | Státusz |
|---|------------------------------------------|--------|---------|
| F1 | Flux ikon: `TowerControl`                | Sidebar navigáció ikon csere (Lucide) | |
| F2 | Sor kattintás → elemek kinyitása         | Job row click: expand elements | |
| F3 | JCF ne navigáljon scheduler-re           | JCF megnyitása Flux-ból: maradjon Flux-ban | |
| F4 | Modify job → open JCF                    | "Módosít" akció nyissa a JCF-et | |
| F5 | Alt+←/→ eltávolítása                     | Billentyűparancs eltávolítás | |
| F6 | Keresés: space, töredék szó, AND         | Szóköz-szeparált részleges szavak AND logikával | |
| F7 | Tab bar scroll eltávolítása              | Tab bar ne scrollozzon | |
| F8 | -CSS: Tailwind preflight elég            | Nincs extra CSS reset szükség | |
| F9 | Station kör kattintás → scheduler új tab | Új böngésző tab nyílik, scheduler scroll a task-hoz | |

## Egyéb

| # | Feladat                                 | Leírás | Státusz |
|---|-----------------------------------------|--------|---------|
| E1 | - Teszt fixture: sok nem-késő job       | Demo/play adathalmaz | |
| E2 | Transporteur lista                      | Új entitás: szállítók (csak név) | |
| E3 | Parti kattintás → departure date toggle | Job "elküldve" státusz, departure date beállítása (mai nap) toggle-ként | |
