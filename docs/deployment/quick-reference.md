# Flux Scheduler - Quick Reference

Gyors referencia a leggyakoribb műveletekhez.

## Elérési utak

| Mit | Hol |
|-----|-----|
| Projekt mappa | `/home/ordo/ordo-replic-os` |
| Környezeti változók | `/home/ordo/ordo-replic-os/.env.production` |
| Apache config | `/etc/apache2/sites-available/flux.conf` |
| Database backups | `/home/ordo/ordo-replic-os/backups/` |
| Apache logok | `/var/log/apache2/flux_*.log` |

## Docker Compose shorthand

Minden parancshoz kell a `--env-file`, ezért érdemes alias-t használni:

```bash
DC="docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml"
```

## Gyakori parancsok

```bash
# Navigálás
cd /home/ordo/ordo-replic-os

# Deployment (szerveren)
./scripts/deploy-server.sh

# Deployment (lokálról — rsync + szerver deploy)
DEPLOY_USER=user DEPLOY_HOST=server ./scripts/deploy-push.sh

# Backup
./scripts/backup-db.sh

# Konténerek állapota
$DC ps

# Logok (összes)
$DC logs -f

# Logok (egy szolgáltatás)
$DC logs -f php
$DC logs -f validation-service
$DC logs -f mariadb

# Újraindítás
$DC restart

# Leállítás
$DC down

# Indítás
$DC up -d

# Shell a konténerben
$DC exec php bash
$DC exec mariadb mysql -uflux_user -p

# Symfony parancsok
$DC exec php php bin/console cache:clear --env=prod --no-warmup
$DC exec php php bin/console cache:warmup --env=prod
$DC exec php php bin/console doctrine:migrations:migrate --no-interaction
```

## Health check

| Szolgáltatás | Parancs |
|--------------|---------|
| Frontend | `curl http://localhost/` (böngészőből: `http://domain/`) |
| API | `curl http://localhost/api/v1/schedule/snapshot` |
| PHP-FPM | `$DC exec -T php php-fpm-healthcheck` |

## Alias-ok

Add hozzá a `~/.bashrc` fájlhoz:

```bash
# Flux Scheduler aliases
export FLUX_DIR="/home/ordo/ordo-replic-os"
alias flux-dc='docker compose --env-file $FLUX_DIR/.env.production -f $FLUX_DIR/docker-compose.yml -f $FLUX_DIR/docker-compose.prod.yml'
alias flux-logs='flux-dc logs -f'
alias flux-ps='flux-dc ps'
alias flux-restart='flux-dc restart'
alias flux-deploy='$FLUX_DIR/scripts/deploy-server.sh'
alias flux-backup='$FLUX_DIR/scripts/backup-db.sh'
```

Aktiválás: `source ~/.bashrc`

## Vészhelyzet

### Teljes újraindítás

```bash
cd /home/ordo/ordo-replic-os
$DC down
$DC up -d
```

### Visszaállítás előző verzióra

A szerveren nincs git. Lokál gépen checkout-old a kívánt verziót, majd push-old újra:

```bash
# Lokál gépen:
git checkout <commit-hash>
DEPLOY_USER=user DEPLOY_HOST=server ./scripts/deploy-push.sh
```

### Database visszaállítás

```bash
cd /home/ordo/ordo-replic-os
source .env.production
gunzip -c backups/flux_YYYYMMDD_HHMMSS.sql.gz | \
  $DC exec -T mariadb \
  mysql -uflux_user -p"$MARIADB_PASSWORD" flux_scheduler
```

## Portok

| Port | Szolgáltatás | Elérhető |
|------|--------------|----------|
| 80 | Apache (HTTP) | Publikus |
| 9000 | PHP-FPM (FastCGI) | Csak localhost (127.0.0.1) |
| 3306 | MariaDB | Csak Docker hálózat |
| 3001 | Validation Service | Csak Docker hálózat |

## Prod konténerek

| Konténer | Leírás |
|----------|--------|
| php | PHP-FPM — Symfony API |
| mariadb | MariaDB — adatbázis (persistent volume) |
| validation-service | Node.js — ütemezés validáció |

**Megjegyzés:** Nginx, Redis és Node (frontend dev) konténerek `dev-only` profile-lal vannak letiltva prod-ban.
