#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
exec "${NODE:-node}" "$repo_root/scripts/check-local.mjs" "$@"
