#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

if [[ "$#" -ne 0 ]]; then
  if [[ "$#" -eq 1 && "$1" == "--hap" ]]; then
    echo "--hap moved to: node scripts/hap-pipeline.mjs build --class iteration" >&2
  fi
  echo "Usage: $0" >&2
  exit 2
fi

node tools/generate-theme-registry.mjs --check

node tools/run-contract-tests.mjs --full
