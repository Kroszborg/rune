#!/usr/bin/env bash
# Build the static docs site and upload it to the VPS (Nginx serves the files;
# nothing to restart). Run from the repo root in Git Bash:  bash scripts/deploy-docs.sh
set -euo pipefail

KEY="${RUNE_DEPLOY_KEY:-/c/Users/abhim/Documents/LightsailDefaultKey-ap-south-1.pem}"
HOST="${RUNE_DEPLOY_HOST:-ubuntu@13.205.28.111}"
ROOT="${RUNE_DEPLOY_ROOT:-/var/www/rune}"

pnpm build --filter=docs
test -f apps/docs/out/index.html || { echo "apps/docs/out is missing; build failed?" >&2; exit 1; }

tar -C apps/docs/out -czf /tmp/rune-out.tgz .
scp -i "$KEY" /tmp/rune-out.tgz "$HOST:/tmp/"
ssh -i "$KEY" "$HOST" "sudo rm -rf $ROOT/* && sudo tar -C $ROOT -xzf /tmp/rune-out.tgz && sudo chown -R www-data:www-data $ROOT && rm -f /tmp/rune-out.tgz"
rm -f /tmp/rune-out.tgz
echo "Deployed to https://rune.kroszborg.co"
