# masterprint-to-flux

Pipeline d'import : CSV MasterPrint → Jobs Flux via API.

## Localisation

Sur la VM Scaleway : `/opt/flux/scripts/masterprint-to-flux/`

## Cron

```cron
*/15 * * * * root /opt/flux/scripts/masterprint-to-flux/flux-masterprint-import.sh >> /var/log/flux-masterprint-import.log 2>&1
```

## Manuel

```bash
# Dry-run (aucun POST)
FLUX_API_PASSWORD=xxx python3 masterprint_to_flux.py --dry-run --report /tmp/r.json

# Run réel
sudo /opt/flux/scripts/masterprint-to-flux/flux-masterprint-import.sh

# Sur N dossiers seulement (debug)
... --limit 10
```

## Config

`masterprint-mapping.yaml` — éditable sans rebuild. Contient :
- `skip_nusec` : codes à ignorer
- `outsourcing` : config du provider générique "Inconnu"
- `mapping` : règles NUSEC → station avec types `fixed | duration_threshold | postes_threshold | format_threshold | composite`

## Tests

```bash
cd /opt/flux/scripts/masterprint-to-flux/
python3 -m pytest tests/ -v
```

## Rapport

Écrit à chaque run dans `/opt/flux/inbox/masterprint/last_import_report.json` :
- `input` : volumes lus des CSV
- `transformed` : jobs construits, ops internes/sous-traitées
- `skipped_operations_by_reason` : pourquoi des ops ont été ignorées
- `posted` : `created` / `already_existing` / `validation_error` / `server_error`
- `errors` : 50 dernières erreurs détaillées
