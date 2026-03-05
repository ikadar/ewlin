# Flux Scheduler - Deployment terv (Debian + Apache)

## Architektúra

```
Szerver előfeltételek: Apache + Docker (semmi más!)

Lokál gép ──rsync──→ Szerver:/home/ordo/ordo-replic-os/

Internet → Apache (:80) → static files (dist/)         ← közvetlen fájlkiszolgálás
                        → PHP-FPM container (:9000)     ← mod_proxy_fcgi

Docker belső hálózat (3 konténer):
  PHP-FPM → MariaDB (:3306)
          → Validation Service (:3001)
```

### Tervezési döntések

| Eredeti terv | Módosítás | Indok |
|-------------|-----------|-------|
| Apache → Nginx container → PHP-FPM | Apache közvetlenül → PHP-FPM + statikus fájlok | Felesleges dupla proxy réteg, Apache natívan tud mindent |
| Node.js 22 + pnpm telepítése szerverre | Docker multi-stage build | Kevesebb szerver dependency |
| git clone + submodule a szerveren | rsync lokálról | Privát repo + 4 privát submodule, nem kell SSH key a szerveren |
| Redis konténer | Elhagyva | Sehol nincs aktívan használva (cache.yaml, messenger kikommentelve) |
| 6 konténer prod-ban | 3 konténer (php, validation, mariadb) | Nginx, Redis, Node dev-only |
| MariaDB/Validation portok nyitva a világra | Nincs port expose (csak PHP-FPM 127.0.0.1:9000) | Biztonsági kockázat volt |
| Swagger UI elérhető prod-ban | Apache-ban blokkolva (403) | API struktúra ne legyen publikus |
| PHP dev config prod-ban | php-prod.ini (display_errors=Off, OPcache) | Biztonság + teljesítmény |
| composer install hiányzott a deploy-ból | deploy-server.sh-ban composer install --no-dev | vendor/ gitignore-olva van |

---

## A fázis: Kód módosítások (egyszer, fejlesztői gépen)

9 fájlt kell létrehozni/módosítani, commitolni és push-olni main-re.

| # | Fájl | Művelet | Mit csinál |
|---|------|---------|------------|
| 1 | `docker/frontend/Dockerfile` | ÚJ | Frontend build Docker-ben (Node.js nem kell szerverre) |
| 2 | `docker-compose.prod.yml` | MÓDOSÍT | Nginx/Redis/Node kikapcsolás, port security, php-prod.ini mount |
| 3 | `docker-compose.yml` | MÓDOSÍT | Redis depends_on eltávolítás PHP-ből |
| 4 | `docker/apache/flux.conf` | ÚJ | Apache VirtualHost (SPA + FastCGI proxy + Swagger blokkolás) |
| 5 | `scripts/deploy-push.sh` | ÚJ | Lokál script: rsync + SSH |
| 6 | `scripts/deploy-server.sh` | ÚJ | Szerver script: Docker build + compose + migrate |
| 7 | `docker/php/php-prod.ini` | ÚJ | PHP prod config (display_errors=Off, OPcache) |
| 8 | `.env.production.example` | MÓDOSÍT | Redis kikommentelés |
| 9 | Dokumentáció | MÓDOSÍT | production-guide.md, quick-reference.md |

A régi `scripts/deploy.sh` és `docker/apache/flux.conf.example` megmarad referenciának (átnevezve).

---

## B fázis: Szerver előkészítés (egyszer, kézzel)

### 1. Apache modulok engedélyezése (szerveren)

Az Apache-nak szüksége van ezekre a modulokra:
- `proxy` + `proxy_fcgi` — PHP-FPM FastCGI kapcsolat
- `headers` — security és cache headerek
- `deflate` — gzip tömörítés
- `rewrite` — URL átírás (később SSL-hez is kell)

```bash
sudo a2enmod proxy proxy_fcgi headers deflate rewrite
sudo systemctl restart apache2
```

### 2. Mappa létrehozása (szerveren)

Az alkalmazás a `/home/ordo/ordo-replic-os` könyvtárba kerül.

```bash
sudo mkdir -p /home/ordo/ordo-replic-os
sudo chown $USER:$USER /home/ordo/ordo-replic-os
```

### 3. Első rsync (lokálról)

A szerverre csak a futtatáshoz szükséges fájlok kerülnek. Dokumentáció, IDE config, dev eszközök kimaradnak.

```bash
rsync -avz --delete \
    --exclude='.git/' \
    --exclude='.claude/' \
    --exclude='.claude-marketplace/' \
    --exclude='.idea/' \
    --exclude='.github/' \
    --exclude='.env' \
    --exclude='.env.production' \
    --exclude='.DS_Store' \
    --exclude='node_modules/' \
    --exclude='services/validation-service/node_modules/' \
    --exclude='apps/web/dist/' \
    --exclude='services/php-api/var/' \
    --exclude='services/php-api/vendor/' \
    --exclude='apps/qa-api/' \
    --exclude='apps/qa-tracker/' \
    --exclude='apps/web/cypress/' \
    --exclude='apps/web/playwright/' \
    --exclude='apps/web/playwright-report/' \
    --exclude='apps/web/.scannerwork/' \
    --exclude='apps/web/scripts/' \
    --exclude='services/php-api/tests/' \
    --exclude='backups/' \
    --exclude='reference/' \
    --exclude='docs/' \
    --exclude='docker-compose.sonarqube.yml' \
    --exclude='CLAUDE.md' \
    --exclude='CHANGELOG.md' \
    --exclude='README.md' \
    --exclude='.gitignore' \
    --exclude='.gitmodules' \
    --exclude='.env.example' \
    ./ ordo@ordo.replic-os.com:/home/ordo/ordo-replic-os/
```

### 4. Environment konfigurálás (szerveren)

A `.env.production` tartalmazza az összes titkos értéket. Soha nem kerül git-be és soha nem szinkronizálódik rsync-kel.

```bash
cd /home/ordo/ordo-replic-os
cp .env.production.example .env.production
nano .env.production
```

Kitöltendő mezők (jelszavak generálása: `openssl rand -hex 32`):

| Változó | Leírás |
|---------|--------|
| `MARIADB_ROOT_PASSWORD` | MariaDB root jelszó (32+ karakter) |
| `MARIADB_PASSWORD` | Alkalmazás DB jelszó (32+ karakter) |
| `APP_SECRET` | Symfony titkos kulcs (32 karakter hex) |
| `DOMAIN` | A tényleges domain név |
| `CORS_ALLOW_ORIGIN` | `http://domain` (HTTP, SSL nélkül!) |

### 5. Apache VirtualHost (szerveren)

Az Apache config fájl a repo-ban van, csak a domain nevet kell kicserélni benne.

```bash
sudo cp /home/ordo/ordo-replic-os/docker/apache/flux.conf /etc/apache2/sites-available/flux.conf
sudo nano /etc/apache2/sites-available/flux.conf   # flux.example.com → valódi domain
sudo a2ensite flux.conf
sudo a2dissite 000-default.conf
sudo systemctl reload apache2
```

### 6. Első deploy (szerveren)

Az első futtatás hosszabb (Docker image-ek letöltése + build), utána cache-ből gyorsabb.

```bash
chmod +x /home/ordo/ordo-replic-os/scripts/deploy-server.sh /home/ordo/ordo-replic-os/scripts/backup-db.sh
/home/ordo/ordo-replic-os/scripts/deploy-server.sh
```

### 7. Backup cron (szerveren)

Napi automatikus database backup hajnali 3-kor.

```bash
crontab -e
# Hozzáadni:
0 3 * * * /home/ordo/ordo-replic-os/scripts/backup-db.sh >> /var/log/flux-backup.log 2>&1
```

### 8. Ellenőrzés (szerveren)

```bash
# Konténerek futnak-e
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# API válaszol-e
curl http://localhost/api/v1/schedule/snapshot

# Frontend elérhető-e (böngészőből)
# http://domain/

# Swagger blokkolva van-e
# http://domain/api/doc → 403 Forbidden
```

---

## C fázis: Frissítés (minden alkalommal)

Egyetlen parancs a lokál gépről:

```bash
./scripts/deploy-push.sh
```

Ez automatikusan elvégzi:

```
Lokál gép                              Szerver
──────────                             ──────

1. rsync fájlok ──────────────────→    /home/ordo/ordo-replic-os/ frissül

2. SSH: deploy-server.sh ─────────→    3. Frontend build (Docker multi-stage)
                                          docker build → dist/ kimásolása

                                       4. Docker images build
                                          php, validation-service

                                       5. Konténerek újraindítása
                                          docker compose down + up

                                       6. File permission fix
                                          chown appuser:appuser var/ vendor/

                                       7. PHP dependency-k + migrációk + cache
                                          composer install --no-dev
                                          doctrine:migrations:migrate
                                          cache:clear + cache:warmup --env=prod

                                       8. Apache reload
                                          sudo systemctl reload apache2
```

Időtartam: kb. 2-5 perc. A leghosszabb a frontend Docker build (~1-2 perc első alkalommal, utána cache-ből gyorsabb).

---

## Rsync exclude lista

| Exclude | Miért |
|---------|-------|
| `.git/` | Nem kell a szerveren, helyet foglal |
| `.claude/`, `.claude-marketplace/` | Claude Code config — csak fejlesztői gépen |
| `.idea/` | IDE beállítások |
| `.github/` | GitHub Actions — szerveren nem kell |
| `.env` | Lokál fejlesztői env |
| `.env.production` | Szerver-specifikus jelszavak — soha ne szinkronizáld felül |
| `.DS_Store` | macOS rendszerfájl |
| `node_modules/` | Docker build kezeli |
| `services/validation-service/node_modules/` | Docker image-be be van építve |
| `apps/web/dist/` | Szerveren épül Docker multi-stage build-ben |
| `apps/qa-api/`, `apps/qa-tracker/` | QA eszközök — csak fejlesztéshez |
| `apps/web/cypress/`, `apps/web/playwright/` | E2E tesztek |
| `apps/web/playwright-report/`, `apps/web/.scannerwork/` | Teszt riportok, SonarQube |
| `apps/web/scripts/` | Dev scriptek (sonar, export-fixture) |
| `services/php-api/var/` | Symfony cache/log — szerveren újragenerálódik |
| `services/php-api/vendor/` | Composer install a konténerben fut (--no-dev) |
| `services/php-api/tests/` | PHPUnit tesztek |
| `backups/` | Szerver-lokális database backup-ok |
| `reference/` | Referencia fájlok — csak fejlesztéshez |
| `docs/` | Dokumentáció — nem kell a futtatáshoz |
| `docker-compose.sonarqube.yml` | SonarQube — csak dev |
| `CLAUDE.md`, `CHANGELOG.md`, `README.md` | Dokumentáció — nem kell a szerveren |
| `.gitignore`, `.gitmodules`, `.env.example` | Git/dev fájlok — nincs git a szerveren |

---

## Későbbi SSL upgrade

Amikor a domain DNS-e rendben van:

```bash
sudo apt install certbot python3-certbot-apache
sudo certbot --apache -d domain.com
# A certbot automatikusan módosítja az Apache configot SSL-re
# Utána CORS_ALLOW_ORIGIN-t is frissíteni kell: http:// → https://
```

---

## Hibaelhárítás

### Konténer nem indul

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs php
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs validation-service
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs mariadb
```

### 502 Bad Gateway / API nem válaszol

```bash
# PHP-FPM fut-e
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps php

# PHP-FPM health check (FastCGI protokoll — curl NEM működik, mert az HTTP-t beszél)
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T php php-fpm-healthcheck
```

### Frontend nem tölt be

```bash
# dist/ létezik-e
ls -la /home/ordo/ordo-replic-os/apps/web/dist/

# Apache config helyes-e
sudo apache2ctl configtest
```

### Database kapcsolati hiba

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec mariadb \
    mysql -uflux_user -p"$MARIADB_PASSWORD" -e "SELECT 1"
```
