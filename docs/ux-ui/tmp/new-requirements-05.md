# New Requirements 05 - Element Model (Deferred)

> **Status:** Deferred - not confirmed if needed
> **Date:** 2026-01-22

---

## REQ-01: Element Model (Job → Element → Task)

> **Status:** Deferred
> **⚠️ FIGYELEM:** Ez egy **ÚJ ENTITY** bevezetése a rendszerbe!

### Jelenlegi adatstruktúra (v0.3.53)

```
Job
 └── Task (1 vagy több, sequenceOrder szerint rendezve)
```

A jelenlegi rendszerben a `Job` közvetlenül tartalmazza a `taskIds`-t, és a precedencia a `sequenceOrder` alapján működik.

### Javasolt új adatstruktúra

```
Job
 └── Element (1 vagy több)
      └── Task (1 vagy több, sequenceOrder szerint)
```

**Példa:** Egy nyomtatási job 3 elemből állhat:
- **COUV** (Couverture/Borító): Offset nyomtatás → Vágás
- **INT** (Intérieur/Belív): Offset nyomtatás → Hajtogatás
- **FIN** (Finition/Kötés): Összeszerelés

### Precedencia szabályok

| Szint | Szabály | Változott? |
|-------|---------|------------|
| **Task szint** | Szekvenciális végrehajtás element-en belül | Nem változott |
| **Element szint** | Element-ek közötti függőség (`prerequisiteElementIds`) | **ÚJ** |

**Fontos:** Az element-ek közötti precedencia csak az első task-ot érinti a függő element-ben.

### Experimental Implementation Reference

> **Branch:** `feature/v0.3.66-element-types`
> **Verziók:** v0.3.66 - v0.3.70

⚠️ **FONTOS:** Ez az implementáció mock-alapú!

| Verzió | Commit | Leírás |
|--------|--------|--------|
| v0.3.66 | `8f7dc60` | Element types in @flux/types |
| v0.3.67 | `dc5e399` | Element mock generators |
| v0.3.68 | `3f3c601` | Element grouping in JobDetailsPanel |
| v0.3.69 | `ae958ad` | Element badge on tiles |
| v0.3.70 | `385157d` | Inter-element precedence logic |

### Element típus (from experimental branch)

```typescript
interface Element {
  id: string;
  jobId: string;
  suffix: string;              // "couv", "int", "fin", "ELT"
  label?: string;              // "Couverture", "Intérieur"
  prerequisiteElementIds: string[];  // required elements
  taskIds: string[];           // tasks within this element
}
```

### Rendszerszintű változások (ha bevezetjük)

Az Element bevezetése a következő komponenseket érinti:

| Komponens | Változás |
|-----------|----------|
| **@flux/types** | Új `Element` típus |
| **PHP Backend** | Új `Element` entity + API endpoints |
| **@flux/schedule-validator** | Inter-element precedence validáció |
| **Frontend** | JobDetailsPanel grouping, Tile badges |

### Kérdések (tisztázandó)
- [ ] **Szükséges-e az Element szint?** (Vagy elég a meglévő Task struktúra?)
- [ ] Az element badge hogyan jelenik meg a tile-on?
- [ ] A precedencia vonalak megjelennek-e element-ek között is?
- [ ] Backward compatibility: mi történik az egyszerű (1 element) job-okkal?
