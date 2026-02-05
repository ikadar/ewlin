# Flux Scheduler - Production Deployment Guide

Ez a dokumentum leírja, hogyan telepítsd a Flux Scheduler alkalmazást production környezetbe Ubuntu szerveren.

## Architektúra

```
┌─────────────────────────────────────────────────────────────┐
│  Ubuntu szerver                                             │
│                                                             │
│  ┌──────────────────┐                                       │
│  │ Apache (:443)    │  ← SSL (Let's Encrypt)                │
│  │ VirtualHost      │                                       │
│  └────────┬─────────┘                                       │
│           │ reverse proxy                                   │
│           ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Docker Compose (:8080)                              │   │
│  │                                                     │   │
│  │  ┌─────────┐  ┌─────────┐  ┌──────────────────┐   │   │
│  │  │ Nginx   │→ │ PHP-FPM │→ │ MariaDB          │   │   │
│  │  │         │  │ (API)   │  │ (persistent vol) │   │   │
│  │  └────┬────┘  └────┬────┘  └──────────────────┘   │   │
│  │       │            │                               │   │
│  │       │            ▼                               │   │
│  │       │       ┌──────────────────┐                │   │
│  │       │       │ Validation Svc   │                │   │
│  │       │       │ (Node.js)        │                │   │
│  │       │       └──────────────────┘                │   │
│  │       │                                            │   │
│  │       └──→ Frontend (React static files)          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Előfeltételek

### Szerver követelmények

- Ubuntu 22.04 LTS vagy újabb
- Minimum 2 GB RAM
- Minimum 20 GB tárhely
- Nyitott portok: 80, 443

### Szükséges szoftverek

```bash
# Docker telepítése
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker  # Vagy jelentkezz ki és vissza

# Node.js és pnpm (frontend build-hez)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pnpm

# Apache modulok engedélyezése
sudo a2enmod proxy proxy_http ssl headers rewrite
```

## Telepítés

### 1. Repository klónozása

```bash
cd /opt  # vagy más megfelelő mappa
sudo git clone --recurse-submodules https://github.com/ikadar/ewlin.git flux
sudo chown -R $USER:$USER flux
cd flux
```

### 2. Környezeti változók beállítása

```bash
cp .env.production.example .env.production
nano .env.production
```

**Fontos:** Cseréld ki az összes `change_me_*` értéket erős, egyedi jelszavakra!

```bash
# Jelszó generálás példa
openssl rand -hex 32
```

Kitöltendő mezők:
- `MARIADB_ROOT_PASSWORD` - MariaDB root jelszó (32+ karakter)
- `MARIADB_PASSWORD` - Alkalmazás DB jelszó (32+ karakter)
- `APP_SECRET` - Symfony titkos kulcs (32 karakter hex)
- `DOMAIN` - A te domainded (pl. flux.example.com)

### 3. SSL tanúsítvány beszerzése

```bash
sudo apt install certbot python3-certbot-apache
sudo certbot certonly --apache -d flux.example.com
```

### 4. Apache VirtualHost beállítása

```bash
sudo cp docker/apache/flux.conf.example /etc/apache2/sites-available/flux.conf
sudo nano /etc/apache2/sites-available/flux.conf
```

Cseréld ki a `flux.example.com`-ot a saját domainedre!

```bash
sudo a2ensite flux.conf
sudo systemctl reload apache2
```

### 5. Scriptek futtathatóvá tétele

```bash
chmod +x scripts/deploy.sh scripts/backup-db.sh
```

### 6. Első deployment

```bash
./scripts/deploy.sh
```

Ez a script:
1. Frissíti a kódot git-ből
2. Build-eli a frontend-et
3. Build-eli a Docker image-eket
4. Elindítja a konténereket
5. Futtatja a database migrációkat

### 7. Ellenőrzés

```bash
# Konténerek állapota
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Logok megtekintése
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Alkalmazás tesztelése
curl -I https://flux.example.com
curl https://flux.example.com/api/v1/schedule/snapshot
```

## Frissítés

Új verzió telepítéséhez egyszerűen futtasd újra:

```bash
cd /opt/flux
./scripts/deploy.sh
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
0 3 * * * /opt/flux/scripts/backup-db.sh >> /var/log/flux-backup.log 2>&1
```

Ez minden nap hajnali 3-kor készít backup-ot.

### Backup visszaállítás

```bash
# Tömörített backup kicsomagolása és visszaállítása
gunzip -c backups/flux_20260204_030000.sql.gz | \
  docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T mariadb \
  mysql -uflux_user -p"$MARIADB_PASSWORD" flux_scheduler
```

## Hibaelhárítás

### Konténer nem indul

```bash
# Részletes logok
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs php
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs validation-service

# Konténer újraindítása
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart php
```

### Database kapcsolati hiba

```bash
# Database konténer állapota
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec mariadb \
  mysql -uflux_user -p"$MARIADB_PASSWORD" -e "SELECT 1"
```

### 502 Bad Gateway

Apache nem éri el a Docker-t:
```bash
# Ellenőrizd, hogy a Docker fut-e
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Ellenőrizd a portot
curl http://127.0.0.1:8080/health
```

### SSL hiba

```bash
# Tanúsítvány ellenőrzése
sudo certbot certificates

# Tanúsítvány megújítása
sudo certbot renew
```

## Monitoring

### Egyszerű health check

```bash
# Crontab-ba (5 percenként)
*/5 * * * * curl -sf https://flux.example.com/health || echo "Flux is down!" | mail -s "Alert" admin@example.com
```

### Logok

```bash
# Apache logok
tail -f /var/log/apache2/flux_error.log
tail -f /var/log/apache2/flux_access.log

# Docker logok
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f --tail=100
```

## Hasznos parancsok

```bash
# Alias-ok hozzáadása (~/.bashrc)
alias flux-logs='docker compose -f /opt/flux/docker-compose.yml -f /opt/flux/docker-compose.prod.yml logs -f'
alias flux-ps='docker compose -f /opt/flux/docker-compose.yml -f /opt/flux/docker-compose.prod.yml ps'
alias flux-restart='docker compose -f /opt/flux/docker-compose.yml -f /opt/flux/docker-compose.prod.yml restart'
alias flux-deploy='/opt/flux/scripts/deploy.sh'
alias flux-backup='/opt/flux/scripts/backup-db.sh'
```

## Biztonsági javaslatok

1. **Firewall beállítása**
   ```bash
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw allow 22
   sudo ufw enable
   ```

2. **Rendszeres frissítések**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

3. **Backup-ok külső tárolása**
   - Szinkronizáld a `backups/` mappát külső storage-ra (S3, rsync, stb.)

4. **SSL tanúsítvány auto-renewal**
   - A certbot alapértelmezetten beállít egy cron job-ot
   - Ellenőrzés: `sudo certbot renew --dry-run`

## Támogatás

Ha problémába ütközöl:
1. Ellenőrizd a logokat
2. Nézd át ezt a dokumentációt
3. Nyiss egy GitHub issue-t: https://github.com/ikadar/ewlin/issues
