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

test_files=()
while IFS= read -r test_file; do
  test_files+=("$test_file")
done < <(find tools -maxdepth 1 -type f -name 'test-*.mjs' ! -name 'test-*-server.mjs' | sort)

if [[ "${#test_files[@]}" -eq 0 ]]; then
  echo "No non-server Harmony contract tests found" >&2
  exit 1
fi

# Existing scripts execute their own assertions. Node reports each file as a
# test, keeps its globals/SDK compiler state in a separate process, and propagates
# any assertion or process failure. Bound concurrency to avoid SDK memory spikes.
node - "${test_files[@]}" <<'JS'
const { run } = require('node:test');
const { spec } = require('node:test/reporters');

const files = process.argv.slice(2);
const signal = AbortSignal.timeout(120000);
signal.addEventListener('abort', () => {
  process.exitCode = 1;
  console.error('Harmony contract gate exceeded its 120-second wall-clock budget');
}, { once: true });
const results = run({ files, concurrency: 6, isolation: 'process', signal });
let passedFiles = 0;
results.on('test:pass', event => {
  if (event.nesting === 0 && !event.skip && !event.todo) passedFiles++;
});
results.on('test:fail', () => { process.exitCode = 1; });
results.on('end', () => {
  if (passedFiles !== files.length) process.exitCode = 1;
});
results.compose(spec).pipe(process.stdout);
JS

echo "Harmony contract tests passed: ${#test_files[@]}"
