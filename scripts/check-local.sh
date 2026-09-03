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

test_count=0
while IFS= read -r test_file; do
  node "$test_file"
  test_count=$((test_count + 1))
done < <(find tools -maxdepth 1 -type f -name 'test-*.mjs' ! -name 'test-*-server.mjs' | sort)

if [[ "$test_count" -eq 0 ]]; then
  echo "No non-server Harmony contract tests found" >&2
  exit 1
fi

echo "Harmony contract tests passed: $test_count"
