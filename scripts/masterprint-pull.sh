#!/usr/bin/env bash
# Pull latest MasterPrint export from Scaleway Object Storage
# Usage: ./scripts/masterprint-pull.sh

set -euo pipefail

BUCKET="s3://masterprint-export"
LOCAL_DIR="inbox/masterprint"
PROFILE="scaleway"
ENDPOINT="https://s3.fr-par.scw.cloud"

# Fix expat linkage issue with Python 3.14 + awscli
export DYLD_LIBRARY_PATH=/opt/homebrew/opt/expat/lib${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}

mkdir -p "$LOCAL_DIR"

echo "Pulling from $BUCKET → $LOCAL_DIR ..."
aws s3 sync "$BUCKET/latest/" "$LOCAL_DIR/" \
  --profile "$PROFILE" \
  --endpoint-url "$ENDPOINT"

echo ""
echo "Files:"
ls -lh "$LOCAL_DIR/"
