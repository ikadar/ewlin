# Mercure Real-Time Client Sync — Architecture Plan

**Status:** Draft
**Scope:** Schedule mutations → server push → all connected clients
**First milestone:** Schedule save/load sync

---

## 1. Áttekintés

### Jelenlegi állapot
- Frontend: RTK Query pull-based cache invalidation — a kliens csak a saját mutációi után frissít
- Backend: 22 domain event definiálva (`ScheduleUpdated`, `TaskAssigned`, stb.), de **nincs dispatch** — az eventek rögzítődnek az entity-ken, de nem kerülnek ki
- Messenger: installálva, `sync://` transport, `event.bus` konfigurálva, de az event routing kommentelve

### Cél
Amikor egy kliens schedule-t módosít (save/load, assignment, reschedule, stb.), a szerver **Mercure SSE-n** keresztül értesíti az összes többi klienst, hogy frissítsék az adataikat.

### Miért Mercure?
- Symfony-natív integráció (`symfony/mercure-bundle`)
- SSE-alapú (egyszerűbb mint WebSocket, HTTP-kompatibilis, nincs külön protokoll)
- Beépített authorization (JWT)
- Docker-ben egyetlen container
- Automatikus reconnect a böngészőben (`EventSource` API)

---

## 2. Architektúra

```
┌─────────────┐     POST /api/v1/...     ┌──────────────┐
│  Client A   │ ──────────────────────── │   Symfony    │
│  (React)    │     HTTP response         │   PHP API    │
│             │ ◄──────────────────────── │              │
└─────────────┘                           │  flush() +   │
                                          │  dispatch    │
┌─────────────┐                           │  domain      │
│  Client B   │     SSE stream            │  events      │
│  (React)    │ ◄─────────────────┐       └──────┬───────┘
└─────────────┘                   │              │
                                  │         POST /.well-known/mercure
┌─────────────┐     SSE stream    │              │
│  Client C   │ ◄─────────────┐  │       ┌──────▼───────┐
│  (React)    │                │  │       │   Mercure    │
└─────────────┘                │  │       │   Hub        │
                               │  │       │  (Caddy)     │
                               └──┴────── │              │
                                          └──────────────┘
```

### Adatfolyam

1. **Client A** küld egy mutáló API hívást (pl. `POST /saved-schedules/{id}/load`)
2. **Symfony** végrehajtja a műveletet, `flush()`, domain event rögzítődik
3. **DomainEventPublisher** (Doctrine PostFlush listener) kigyűjti az eventeket és dispatch-eli a Messenger event bus-ra
4. **MercureEventSubscriber** (Messenger handler) fogadja a `ScheduleUpdated` eventet és publikálja a Mercure Hub-ra
5. **Mercure Hub** push-olja az SSE stream-en az összes feliratkozott kliensnek
6. **Client B, C** (React) fogadja az SSE üzenetet, RTK Query cache-t invalidálja → automatikus refetch

---

## 3. Backend implementáció

### 3.1 Mercure Hub — Docker

```yaml
# docker-compose.yml — új service
mercure:
  image: dunglas/mercure:latest
  container_name: flux-mercure
  restart: unless-stopped
  environment:
    SERVER_NAME: ':3000'
    MERCURE_PUBLISHER_JWT_KEY: '${MERCURE_JWT_SECRET}'
    MERCURE_SUBSCRIBER_JWT_KEY: '${MERCURE_JWT_SECRET}'
    MERCURE_EXTRA_DIRECTIVES: |
      cors_origins http://localhost:5173 http://localhost:8080
      anonymous
  ports:
    - "${MERCURE_PORT:-3000}:3000"
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
    interval: 10s
    timeout: 5s
    retries: 3
  networks:
    - flux-network
```

> **`anonymous`**: Fejlesztés közben engedélyezzük az anonymous subscriber-eket (nem kell JWT a klienseknek olvasáshoz). Production-ben ezt JWT-re cseréljük.

### 3.2 Symfony Mercure Bundle

```bash
composer require symfony/mercure-bundle
```

**config/packages/mercure.yaml:**
```yaml
mercure:
  hubs:
    default:
      url: '%env(MERCURE_URL)%'
      jwt:
        secret: '%env(MERCURE_JWT_SECRET)%'
        publish: ['*']
```

**.env kiegészítés:**
```dotenv
MERCURE_URL=http://mercure:3000/.well-known/mercure
MERCURE_JWT_SECRET=your-256-bit-secret-change-in-production
MERCURE_PUBLIC_URL=http://localhost:3000/.well-known/mercure
```

### 3.3 Domain Event Dispatching

Jelenleg az entity-k rögzítik az eventeket (`RecordsDomainEvents` trait), de senki nem hívja meg a `pullDomainEvents()`-et flush után.

**Új: `DomainEventPublisher`** — Doctrine PostFlush EventListener

```php
// src/EventListener/DomainEventPublisher.php

namespace App\EventListener;

use App\Event\RecordsDomainEvents;
use Doctrine\ORM\Event\PostFlushEventArgs;
use Symfony\Component\Messenger\MessageBusInterface;

class DomainEventPublisher
{
    private array $entities = [];

    public function __construct(
        private readonly MessageBusInterface $eventBus,
    ) {}

    // Doctrine postFlush — collect entities with events
    public function postFlush(PostFlushEventArgs $args): void
    {
        $uow = $args->getObjectManager()->getUnitOfWork();

        foreach ($this->entities as $entity) {
            foreach ($entity->pullDomainEvents() as $event) {
                $this->eventBus->dispatch($event);
            }
        }
        $this->entities = [];
    }

    // Called from onFlush to collect tracked entities
    public function onFlush(\Doctrine\ORM\Event\OnFlushEventArgs $args): void
    {
        $uow = $args->getObjectManager()->getUnitOfWork();

        foreach ($uow->getScheduledEntityUpdates() as $entity) {
            if ($entity instanceof RecordsDomainEvents && $entity->hasDomainEvents()) {
                $this->entities[spl_object_id($entity)] = $entity;
            }
        }
    }
}
```

> **Megjegyzés:** A `RecordsDomainEvents` jelenleg trait — interface-ként is definiálni kell a type check-hez, vagy a trait-hez kell egy `hasDomainEvents()` metódus (ami már létezik).

### 3.4 Mercure Publisher — Messenger Handler

```php
// src/MessageHandler/MercureScheduleUpdateHandler.php

namespace App\MessageHandler;

use App\Event\Schedule\ScheduleUpdated;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler(bus: 'event.bus')]
class MercureScheduleUpdateHandler
{
    public function __construct(
        private readonly HubInterface $hub,
    ) {}

    public function __invoke(ScheduleUpdated $event): void
    {
        $update = new Update(
            topics: ['schedule/updates'],
            data: json_encode([
                'type' => 'schedule.updated',
                'scheduleId' => $event->scheduleId,
                'version' => $event->version,
                'changeType' => $event->changeType,
                'affectedTaskIds' => $event->affectedTaskIds,
                'timestamp' => $event->occurredAt->format(\DateTimeInterface::ATOM),
            ]),
        );

        $this->hub->publish($update);
    }
}
```

### 3.5 Messenger Routing

```yaml
# config/packages/messenger.yaml — routing kiegészítés
routing:
    'App\Event\Schedule\ScheduleUpdated': sync
```

> **sync** transport: az event szinkronban, a HTTP response előtt publikálódik a Mercure-re. Ez egyszerű és megbízható. Később async-ra váltható ha szükséges.

---

## 4. Frontend implementáció

### 4.1 Mercure EventSource hook

```typescript
// src/hooks/useMercureSubscription.ts

import { useEffect, useRef } from 'react';
import { scheduleApi } from '../store/api/scheduleApi';
import { useAppDispatch } from '../store';

const MERCURE_URL = import.meta.env.VITE_MERCURE_URL
  ?? 'http://localhost:3000/.well-known/mercure';

interface ScheduleUpdateEvent {
  type: 'schedule.updated';
  scheduleId: string;
  version: number;
  changeType: string;
  affectedTaskIds: string[];
  timestamp: string;
}

export function useMercureSubscription() {
  const dispatch = useAppDispatch();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = new URL(MERCURE_URL);
    url.searchParams.append('topic', 'schedule/updates');

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data: ScheduleUpdateEvent = JSON.parse(event.data);

      if (data.type === 'schedule.updated') {
        // Invalidate RTK Query cache → automatic refetch
        dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
      }
    };

    eventSource.onerror = () => {
      // EventSource automatically reconnects
      console.warn('[Mercure] Connection lost, reconnecting...');
    };

    return () => {
      eventSource.close();
    };
  }, [dispatch]);
}
```

### 4.2 Integráció az App-ba

```typescript
// App.tsx — a hook meghívása a gyökér komponensben
function App() {
  useMercureSubscription();
  // ... existing code
}
```

### 4.3 Optimalizáció: saját mutáció kiszűrése

A kliens, amelyik a mutációt végrehajtotta, már RTK Query cache invalidation-nel frissített. Nem kell duplán frissítenie.

**Megoldás:** A mutáló kliens egy rövid "mute window"-t tart:

```typescript
// A mutáció előtt: set a mute flag
// Mercure event érkezésekor: ha mute aktív, skip invalidation
const [isMuted, setIsMuted] = useState(false);

// Save mutation wrapper:
const handleSave = async () => {
  setIsMuted(true);
  await saveSchedule({ name });
  setTimeout(() => setIsMuted(false), 2000); // 2s grace period
};

// In Mercure handler:
if (!isMuted && data.type === 'schedule.updated') {
  dispatch(scheduleApi.util.invalidateTags(['Snapshot']));
}
```

---

## 5. Implementációs terv — fázisonként

### Phase 1: Infrastructure (Mercure Hub + Bundle)
- [ ] Mercure Hub hozzáadása a `docker-compose.yml`-hez
- [ ] `symfony/mercure-bundle` telepítése
- [ ] Mercure config (`mercure.yaml`, `.env`)
- [ ] CORS beállítás a Mercure hub-on (localhost:5173 dev)
- [ ] Smoke test: `curl` POST a hub-ra, SSE stream olvasás

### Phase 2: Domain Event Dispatching
- [ ] `DomainEventPublisher` Doctrine listener implementálása
- [ ] Interface kiemelés a `RecordsDomainEvents` trait-ből (ha szükséges)
- [ ] Messenger routing aktiválása (`ScheduleUpdated → sync`)
- [ ] Unit test: event dispatch after flush

### Phase 3: Mercure Publishing
- [ ] `MercureScheduleUpdateHandler` implementálása
- [ ] Integration test: schedule save → Mercure Update published
- [ ] E2E verify: `curl` subscribe + API call → SSE event megjelenik

### Phase 4: Frontend Subscription
- [ ] `useMercureSubscription` hook
- [ ] `VITE_MERCURE_URL` env var
- [ ] Integráció App.tsx-be
- [ ] Saját mutáció kiszűrése (mute window)
- [ ] Manuális teszt: 2 böngésző tab, egyikben save → másik frissül

### Phase 5: Kiterjesztés (későbbi release)
- [ ] Minden `ScheduleUpdated` changeType kezelése (assignment, reschedule, unassignment, completion)
- [ ] Job/Element események publikálása
- [ ] Production JWT authorization (anonymous → authenticated subscribers)
- [ ] Toast notification a kliensben ("Schedule updated by another user")

---

## 6. Érintett fájlok

### Backend (új)
| Fájl | Leírás |
|------|--------|
| `src/EventListener/DomainEventPublisher.php` | Doctrine PostFlush → Messenger dispatch |
| `src/MessageHandler/MercureScheduleUpdateHandler.php` | Messenger → Mercure publish |
| `config/packages/mercure.yaml` | Mercure bundle config |

### Backend (módosítandó)
| Fájl | Módosítás |
|------|-----------|
| `composer.json` | + `symfony/mercure-bundle` |
| `.env` | + `MERCURE_URL`, `MERCURE_JWT_SECRET`, `MERCURE_PUBLIC_URL` |
| `config/packages/messenger.yaml` | Routing aktiválás |
| `config/services.yaml` | DomainEventPublisher regisztráció (ha nem autowire) |

### Frontend (új)
| Fájl | Leírás |
|------|--------|
| `src/hooks/useMercureSubscription.ts` | EventSource hook |

### Frontend (módosítandó)
| Fájl | Módosítás |
|------|-----------|
| `.env` / `.env.development` | + `VITE_MERCURE_URL` |
| `src/App.tsx` | + `useMercureSubscription()` hívás |

### Infra (módosítandó)
| Fájl | Módosítás |
|------|-----------|
| `docker-compose.yml` | + `mercure` service |
| `docker-compose.prod.yml` | + `mercure` service (prod config) |

---

## 7. Kockázatok és döntések

| Kérdés | Döntés | Indoklás |
|--------|--------|----------|
| Sync vs async dispatch | **Sync** (Phase 1) | Egyszerűbb, a Mercure publish gyors (<10ms). Async ha szükséges later. |
| Anonymous vs JWT subscribers | **Anonymous** (dev) | Fejlesztéshez egyszerűbb. Prod-ban JWT-re váltunk. |
| Full snapshot push vs invalidation | **Invalidation** | A Mercure event csak jelzi hogy "frissülj", a kliens maga fetch-eli az új snapshot-ot. Egyszerűbb, nincs adat-duplikáció. |
| Saját mutáció kiszűrése | **Mute window** | Egyszerű, elkerüli a dupla refetch-et. |
| Topic granularity | **Egyetlen topic** (`schedule/updates`) | Kezdetben elég. Később lehet `schedule/{id}/updates` ha multi-schedule. |
