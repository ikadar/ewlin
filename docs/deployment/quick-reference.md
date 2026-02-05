# Flux Scheduler - Quick Reference

Gyors referencia a leggyakoribb műveletekhez.

## Elérési utak

| Mit | Hol |
|-----|-----|
| Projekt mappa | `/opt/flux` |
| Környezeti változók | `/opt/flux/.env.production` |
| Apache config | `/etc/apache2/sites-available/flux.conf` |
| SSL tanúsítványok | `/etc/letsencrypt/live/flux.example.com/` |
| Database backups | `/opt/flux/backups/` |
| Apache logok | `/var/log/apache2/flux_*.log` |

## Gyakori parancsok

```bash
# Navigálás
cd /opt/flux

# Deployment
./scripts/deploy.sh

# Backup
./scripts/backup-db.sh

# Konténerek állapota
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Logok (összes)
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Logok (egy szolgáltatás)
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f php
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f validation-service
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f mariadb

# Újraindítás
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart

# Leállítás
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Indítás
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d

# Shell a konténerben
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec php bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec mariadb mysql -uflux_user -p

# Symfony parancsok
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec php php bin/console cache:clear
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec php php bin/console doctrine:migrations:migrate
```

## Health check URL-ek

| Szolgáltatás | URL |
|--------------|-----|
| Frontend | `https://flux.example.com/` |
| API | `https://flux.example.com/api/v1/schedule/snapshot` |
| Nginx health | `http://127.0.0.1:8080/health` |

## Alias-ok

Add hozzá a `~/.bashrc` fájlhoz:

```bash
# Flux Scheduler aliases
export FLUX_DIR="/opt/flux"
alias flux-cd='cd $FLUX_DIR'
alias flux-logs='docker compose -f $FLUX_DIR/docker-compose.yml -f $FLUX_DIR/docker-compose.prod.yml logs -f'
alias flux-ps='docker compose -f $FLUX_DIR/docker-compose.yml -f $FLUX_DIR/docker-compose.prod.yml ps'
alias flux-restart='docker compose -f $FLUX_DIR/docker-compose.yml -f $FLUX_DIR/docker-compose.prod.yml restart'
alias flux-deploy='$FLUX_DIR/scripts/deploy.sh'
alias flux-backup='$FLUX_DIR/scripts/backup-db.sh'
```

Aktiválás: `source ~/.bashrc`

## Vészhelyzet

### Teljes újraindítás

```bash
cd /opt/flux
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Visszaállítás előző verzióra

```bash
cd /opt/flux
git log --oneline -5  # Commit history
git checkout <commit-hash>
git submodule update --init --recursive
./scripts/deploy.sh
```

### Database visszaállítás

```bash
cd /opt/flux
source .env.production
gunzip -c backups/flux_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T mariadb \
  mysql -uflux_user -p"$MARIADB_PASSWORD" flux_scheduler
```

## Portok

| Port | Szolgáltatás | Elérhető |
|------|--------------|----------|
| 80 | Apache (HTTP→HTTPS redirect) | Publikus |
| 443 | Apache (HTTPS) | Publikus |
| 8080 | Docker Nginx | Csak localhost |
| 3306 | MariaDB | Csak Docker hálózat |
| 6379 | Redis | Csak Docker hálózat |
| 3001 | Validation Service | Csak Docker hálózat |
