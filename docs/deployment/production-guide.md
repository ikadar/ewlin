# Flux Scheduler - Production Deployment Guide

Ez a dokumentum leírja, hogyan telepítsd a Flux Scheduler alkalmazást production környezetbe Debian/Ubuntu szerveren.

A részletes deployment tervet (tervezési döntésekkel) lásd: [deployment-plan.md](./deployment-plan.md)

## Architektúra

```
┌──────────────────────────────────────────────────────────────┐
│  Debian/Ubuntu szerver                                        │
│  Előfeltételek: Apache + Docker                               │
│                                                               │
│  Lokál gép ──rsync──→ /home/ordo/ordo-replic-os/             │
│                                                               │
│  ┌──────────────────┐                                         │
│  │ Apache (:80)     │                                         │
│  │ VirtualHost      │                                         │
│  └────────┬─────────┘                                         │
│           │                                                   │
│           ├──→ /apps/web/dist/ (frontend static files)        │
│           │                                                   │
│           └──→ fcgi://127.0.0.1:9000 (PHP-FPM)               │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ Docker Compose (3 konténer)                         │     │
│  │                                                     │     │
│  │  ┌─────────┐  ┌──────────────────┐                 │     │
│  │  │ PHP-FPM │→ │ MariaDB          │                 │     │
│  │  │ (:9000) │  │ (persistent vol) │                 │     │
│  │  └────┬────┘  └──────────────────┘                 │     │
│  │       │                                             │     │
│  │       ▼                                             │     │
│  │  ┌──────────────────┐                               │     │
│  │  │ Validation Svc   │                               │     │
│  │  │ (Node.js :3001)  │                               │     │
│  │  └──────────────────┘                               │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

## Előfeltételek

### Szerver követelmények

- Debian 12+ vagy Ubuntu 22.04 LTS+
- Minimum 2 GB RAM
- Minimum 20 GB tárhely
- Nyitott port: 80 (443 ha SSL kell)

### Szükséges szoftverek

Csak Apache és Docker kell a szerveren. Node.js **nem** szükséges (a frontend Docker-ben épül).

```bash
# Docker telepítése (ha még nincs)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Apache modulok engedélyezése
sudo a2enmod proxy proxy_fcgi headers deflate rewrite
sudo systemctl restart apache2
```

## Telepítés

### 1. Mappa létrehozása

```bash
sudo mkdir -p /home/ordo/ordo-replic-os
sudo chown $USER:$USER /home/ordo/ordo-replic-os
```

### 2. Kód szinkronizálása (lokálról)

A kód rsync-kel kerül a szerverre (git nem kell a szerveren):

```bash
rsync -avz --delete \
    --exclude='.git/' --exclude='node_modules/' \
    --exclude='services/validation-service/node_modules/' \
    --exclude='apps/web/dist/' --exclude='.env.production' \
    --exclude='backups/' \
    ./ user@server:/home/ordo/ordo-replic-os/
```

### 3. Környezeti változók beállítása (szerveren)

```bash
cd /home/ordo/ordo-replic-os
cp .env.production.example .env.production
nano .env.production
```

**Fontos:** Cseréld ki az összes `change_me_*` értéket erős, egyedi jelszavakra!

```bash
# Jelszó generálás
openssl rand -hex 32
```

Kitöltendő mezők:
- `MARIADB_ROOT_PASSWORD` - MariaDB root jelszó (32+ karakter)
- `MARIADB_PASSWORD` - Alkalmazás DB jelszó (32+ karakter)
- `APP_SECRET` - Symfony titkos kulcs (32 karakter hex)
- `DOMAIN` - A te domainded (pl. flux.example.com)
- `CORS_ALLOW_ORIGIN` - `http://domain` (HTTP amíg nincs SSL)

### 4. Apache VirtualHost beállítása (szerveren)

```bash
sudo cp /home/ordo/ordo-replic-os/docker/apache/flux.conf /etc/apache2/sites-available/flux.conf
sudo nano /etc/apache2/sites-available/flux.conf
```

Cseréld ki a `flux.example.com`-ot a saját domainedre!

```bash
sudo a2ensite flux.conf
sudo a2dissite 000-default.conf
sudo systemctl reload apache2
```

### 5. Scriptek futtathatóvá tétele (szerveren)

```bash
chmod +x scripts/deploy-server.sh scripts/deploy-push.sh scripts/backup-db.sh
```

### 6. Első deployment (szerveren)

```bash
./scripts/deploy-server.sh
```

Ez a script:
1. Build-eli a frontend-et Docker-ben (Node.js nem kell)
2. Build-eli a Docker image-eket (PHP-FPM, Validation Service)
3. Elindítja a konténereket
4. Javítja a fájl jogosultságokat
5. Telepíti a PHP dependency-ket (composer install)
6. Futtatja a database migrációkat
7. Warmup-olja a Symfony cache-t
8. Reload-olja az Apache-t

### 7. Ellenőrzés (szerveren)

```bash
# Konténerek állapota
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml ps

# API tesztelése
curl http://localhost/api/v1/schedule/snapshot

# Frontend (böngészőből)
# http://domain/
```

## Frissítés

Lokál gépről egyetlen paranccsal:

```bash
DEPLOY_USER=user DEPLOY_HOST=server ./scripts/deploy-push.sh
```

## Backup

### Manuális backup

```bash
./scripts/backup-db.sh
```

A backup a `backups/` mappába kerül, gzip tömörítve.

### Automatikus napi backup (cron)

```bash
crontab -e
```

Add hozzá:
```
0 3 * * * /home/ordo/ordo-replic-os/scripts/backup-db.sh >> /var/log/flux-backup.log 2>&1
```

### Backup visszaállítás

```bash
source .env.production
gunzip -c backups/flux_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml exec -T mariadb \
  mysql -uflux_user -p"$MARIADB_PASSWORD" flux_scheduler
```

## Hibaelhárítás

### Konténer nem indul

```bash
DC="docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml"
$DC logs php
$DC logs validation-service
$DC logs mariadb
$DC restart php
```

### Database kapcsolati hiba

```bash
$DC exec mariadb mysql -uflux_user -p"$MARIADB_PASSWORD" -e "SELECT 1"
```

### 502 Bad Gateway / API nem válaszol

```bash
# PHP-FPM fut-e
$DC ps php

# PHP-FPM health check (FastCGI — curl nem működik!)
$DC exec -T php php-fpm-healthcheck
```

### Frontend nem tölt be

```bash
# dist/ létezik-e
ls -la /home/ordo/ordo-replic-os/apps/web/dist/

# Apache config helyes-e
sudo apache2ctl configtest
```

## Monitoring

### Logok

```bash
# Apache logok
tail -f /var/log/apache2/flux_error.log
tail -f /var/log/apache2/flux_access.log

# Docker logok
$DC logs -f --tail=100
```

## Hasznos parancsok

```bash
# Alias-ok hozzáadása (~/.bashrc)
export FLUX_DIR="/home/ordo/ordo-replic-os"
alias flux-dc='docker compose --env-file $FLUX_DIR/.env.production -f $FLUX_DIR/docker-compose.yml -f $FLUX_DIR/docker-compose.prod.yml'
alias flux-logs='flux-dc logs -f'
alias flux-ps='flux-dc ps'
alias flux-restart='flux-dc restart'
alias flux-deploy='$FLUX_DIR/scripts/deploy-server.sh'
alias flux-backup='$FLUX_DIR/scripts/backup-db.sh'
```

## Biztonsági javaslatok

1. **Firewall beállítása**
   ```bash
   sudo ufw allow 80
   sudo ufw allow 22
   sudo ufw enable
   ```

2. **Rendszeres frissítések**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

3. **Backup-ok külső tárolása** — szinkronizáld a `backups/` mappát külső storage-ra

4. **SSL tanúsítvány** (későbbi lépés)
   ```bash
   sudo apt install certbot python3-certbot-apache
   sudo certbot --apache -d domain.com
   # Utána CORS_ALLOW_ORIGIN-t frissíteni: http:// → https://
   ```
