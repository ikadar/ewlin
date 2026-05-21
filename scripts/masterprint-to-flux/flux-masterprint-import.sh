#!/usr/bin/env bash
# Wrapper bash invoqué par cron toutes les 15 min.
# Charge les credentials depuis /etc/flux-import.env puis lance le script Python.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="/etc/flux-import.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${FLUX_API_PASSWORD:-}" ]]; then
  echo "$(date -Iseconds) ERROR: FLUX_API_PASSWORD not set (expected in $ENV_FILE)" >&2
  exit 3
fi

exec python3 "$SCRIPT_DIR/masterprint_to_flux.py" "$@"
