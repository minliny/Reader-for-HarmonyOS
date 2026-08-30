#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

if [[ "$#" -gt 1 ]] || [[ "$#" -eq 1 && "$1" != "--hap" ]]; then
  echo "Usage: $0 [--hap]" >&2
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

if [[ "${1:-}" == "--hap" ]]; then
  # A test HAP is distributable only while every packaged source still passes
  # the real Core import/search/detail/toc/content chain.
  node tools/verify-bundled-test-book-sources-live.mjs
  hvigorw="${HVIGORW:-/Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw}"
  if [[ ! -x "$hvigorw" ]]; then
    echo "Hvigor executable not found: $hvigorw" >&2
    exit 1
  fi
  "$hvigorw" assembleHap --mode module \
    -p product=default -p module=entry@default -p buildMode=debug \
    --no-daemon --no-incremental
  node tools/verify-bundled-test-book-source-haps.mjs \
    entry/build/default/outputs/default/entry-default-signed.hap \
    entry/build/default/outputs/default/entry-default-unsigned.hap
fi
