#!/usr/bin/env bash
set -euo pipefail

# Remote site control helper for adshortsai.com
# Usage:
#   ./sitectl-remote.sh enable
#   ./sitectl-remote.sh disable
#   ./sitectl-remote.sh reload
#   ./sitectl-remote.sh status
# Optional env vars:
#   VM_HOST=89.169.155.51 VM_USER=aldima DOMAIN=adshortsai.com

VM_HOST=${VM_HOST:-89.169.155.51}
VM_USER=${VM_USER:-aldima}
DOMAIN=${DOMAIN:-adshortsai.com}

usage() { echo "Usage: $0 {enable|disable|reload|status}" 1>&2; }

cmd=${1:-}
if [[ -z "$cmd" ]]; then usage; exit 1; fi

ssh_cmd=(ssh -o StrictHostKeyChecking=accept-new -l "$VM_USER" "$VM_HOST")

case "$cmd" in
  enable|disable|reload|status)
    "${ssh_cmd[@]}" "/usr/local/bin/sitectl $cmd" || exit 1
    ;;
  *)
    usage; exit 1
    ;;
esac
