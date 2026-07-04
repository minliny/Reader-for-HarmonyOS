#!/usr/bin/env bash
set -uo pipefail

# run_unified_evidence_simulator.sh — build + install + run the unified
# evidence harness on the HarmonyOS simulator and validate the resulting
# artifact against the Core protocol/unified-evidence.schema.json.
#
# Pipeline:
#   1. Build the HAP (debug, unsigned) via hvigorw.
#   2. Start the simulator (if not running) via hdc.
#   3. Install the HAP to the simulator.
#   4. Launch the app and wait for the evidence panel to produce an artifact.
#   5. Pull the artifact via hdc file recv.
#   6. Validate with the Core Python validator.
#
# Usage:
#   scripts/run_unified_evidence_simulator.sh
#
# Environment:
#   HDC_BIN                      — hdc binary path (default: hdc)
#   HARMONYOS_HAP_PATH           — override the HAP path (skip build)
#   HARMONYOS_BUNDLE_NAME        — bundle name (default: com.reader.core)
#   HARMONYOS_EVIDENCE_OUT_DIR   — output dir for artifact (default: ./artifacts/unified-evidence/<stamp>)
#   READER_CORE_NATIVE_ROOT      — path to Reader-Core-Native repo (default: sibling dir)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HDC_BIN="${HDC_BIN:-hdc}"
HARMONYOS_BUNDLE_NAME="${HARMONYOS_BUNDLE_NAME:-com.reader.core}"
READER_CORE_NATIVE_ROOT="${READER_CORE_NATIVE_ROOT:-/Users/minliny/Documents/Reader-Core-Native}"
VALIDATOR="$READER_CORE_NATIVE_ROOT/tools/platform-evidence-validator/platform_evidence_validator.py"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${HARMONYOS_EVIDENCE_OUT_DIR:-$ROOT_DIR/artifacts/unified-evidence/$STAMP}"
LATEST_DIR="$ROOT_DIR/artifacts/unified-evidence/latest"
HAP_PATH="${HARMONYOS_HAP_PATH:-$ROOT_DIR/entry/build/default/outputs/default/entry-default-unsigned.hap}"
ARTIFACT_LOCAL="$OUT_DIR/unified-evidence.json"
LOG_FILE="$OUT_DIR/run.log"
DEVICE_ARTIFACT_PATH="/data/storage/el2/base/haps/entry/files/unified-evidence.json"
POLL_TIMEOUT_SECS=120
POLL_INTERVAL_SECS=3

mkdir -p "$OUT_DIR"

log() {
  printf '%s\n' "$*" | tee -a "$LOG_FILE"
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

STATUS="BLOCKED"
FAILURE=""

write_summary() {
  local generated_at
  generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  {
    printf '{\n'
    printf '  "schemaVersion": "harmonyos-unified-evidence-simulator.v1",\n'
    printf '  "status": "%s",\n' "$STATUS"
    printf '  "failure": "%s",\n' "$(json_escape "$FAILURE")"
    printf '  "generatedAt": "%s",\n' "$generated_at"
    printf '  "hap": "%s",\n' "$(json_escape "$HAP_PATH")"
    printf '  "artifact": "%s",\n' "$(json_escape "$ARTIFACT_LOCAL")"
    printf '  "validator": "%s"\n' "$(json_escape "$VALIDATOR")"
    printf '}\n'
  } > "$OUT_DIR/summary.json"
}

update_latest_pointer() {
  if [[ "$OUT_DIR" != "$LATEST_DIR" ]]; then
    mkdir -p "$(dirname "$LATEST_DIR")"
    ln -sfn "$OUT_DIR" "$LATEST_DIR"
  fi
}

finish_blocked() {
  STATUS="BLOCKED"
  FAILURE="$1"
  write_summary
  update_latest_pointer
  log "BLOCKED: $1"
  exit 3
}

finish_pass() {
  STATUS="PASS"
  FAILURE=""
  write_summary
  update_latest_pointer
  log "PASS: artifact validated at $ARTIFACT_LOCAL"
  exit 0
}

log "HarmonyOS unified evidence simulator run started at $STAMP"
log "root=$ROOT_DIR"
log "out=$OUT_DIR"
log "hap=$HAP_PATH"

# Step 1: Build the HAP (unless overridden).
if [[ -z "${HARMONYOS_HAP_PATH:-}" ]]; then
  log "+ ./hvigorw assembleHap --no-daemon --mode module -p product=default"
  set +e
  (cd "$ROOT_DIR" && ./hvigorw assembleHap --no-daemon --mode module -p product=default) 2>&1 | tee -a "$LOG_FILE"
  BUILD_EXIT="${PIPESTATUS[0]}"
  set -e
  if [[ "$BUILD_EXIT" != "0" ]]; then
    finish_blocked "hvigorw assembleHap failed (exit $BUILD_EXIT)"
  fi
fi

if [[ ! -f "$HAP_PATH" ]]; then
  finish_blocked "HAP not found: $HAP_PATH"
fi

# Step 2: Verify hdc is available and a simulator target is connected.
if ! command -v "$HDC_BIN" >/dev/null 2>&1; then
  finish_blocked "hdc is unavailable; set HDC_BIN or install DevEco command-line tools"
fi

log "+ $HDC_BIN list targets"
HDC_TARGETS_FILE="$OUT_DIR/hdc_targets.txt"
"$HDC_BIN" list targets > "$HDC_TARGETS_FILE" 2>&1
HDC_EXIT=$?
sed 's/^/  /' "$HDC_TARGETS_FILE" | tee -a "$LOG_FILE" >/dev/null

if [[ "$HDC_EXIT" != "0" ]]; then
  finish_blocked "hdc list targets exited $HDC_EXIT"
fi

# Select the first non-empty target.
TARGET="$(grep -Ev '^[[:space:]]*$|^\[Empty\]$' "$HDC_TARGETS_FILE" | sed -E 's/^[[:space:]]+//; s/[[:space:]].*$//' | grep -Ev '^\[.*\]$' | head -n 1 || true)"
if [[ -z "$TARGET" ]]; then
  finish_blocked "no hdc target detected; start the HarmonyOS simulator first"
fi
log "selected target=$TARGET"

# Step 3: Install the HAP to the simulator.
log "+ $HDC_BIN -t $TARGET install -r $HAP_PATH"
set +e
"$HDC_BIN" -t "$TARGET" install -r "$HAP_PATH" 2>&1 | tee -a "$LOG_FILE"
INSTALL_EXIT="${PIPESTATUS[0]}"
set -e
if [[ "$INSTALL_EXIT" != "0" ]]; then
  finish_blocked "hdc install failed (exit $INSTALL_EXIT)"
fi

# Step 4: Launch the app and poll for the evidence artifact.
log "+ $HDC_BIN -t $TARGET shell aa start -a EntryAbility -b $HARMONYOS_BUNDLE_NAME"
set +e
"$HDC_BIN" -t "$TARGET" shell aa start -a EntryAbility -b "$HARMONYOS_BUNDLE_NAME" 2>&1 | tee -a "$LOG_FILE"
LAUNCH_EXIT="${PIPESTATUS[0]}"
set -e
if [[ "$LAUNCH_EXIT" != "0" ]]; then
  finish_blocked "app launch failed (exit $LAUNCH_EXIT)"
fi

# Wait for the app to be ready, then trigger the evidence panel.
# NOTE: The UnifiedEvidenceRunner is triggered manually via the
# "Runtime Evidence" button in the UI. For automated runs, a headless
# launch mode (want parameter) would be needed — that is out of scope for
# this phase. The script polls for the artifact file to appear.
log "Polling for evidence artifact (timeout=${POLL_TIMEOUT_SECS}s)..."
ELAPSED=0
while [[ "$ELAPSED" -lt "$POLL_TIMEOUT_SECS" ]]; do
  set +e
  "$HDC_BIN" -t "$TARGET" shell "test -f $DEVICE_ARTIFACT_PATH && echo EXISTS" 2>&1 | tee -a "$LOG_FILE" | grep -q "EXISTS"
  FOUND=$?
  set -e
  if [[ "$FOUND" == "0" ]]; then
    log "artifact detected on device after ${ELAPSED}s"
    break
  fi
  sleep "$POLL_INTERVAL_SECS"
  ELAPSED=$((ELAPSED + POLL_INTERVAL_SECS))
done

if [[ "$ELAPSED" -ge "$POLL_TIMEOUT_SECS" ]]; then
  finish_blocked "timed out waiting for evidence artifact on device (did you tap 'Runtime Evidence'?)"
fi

# Step 5: Pull the artifact via hdc file recv.
log "+ $HDC_BIN -t $TARGET file recv $DEVICE_ARTIFACT_PATH $ARTIFACT_LOCAL"
set +e
"$HDC_BIN" -t "$TARGET" file recv "$DEVICE_ARTIFACT_PATH" "$ARTIFACT_LOCAL" 2>&1 | tee -a "$LOG_FILE"
RECV_EXIT="${PIPESTATUS[0]}"
set -e
if [[ "$RECV_EXIT" != "0" ]]; then
  finish_blocked "hdc file recv failed (exit $RECV_EXIT)"
fi

if [[ ! -s "$ARTIFACT_LOCAL" ]]; then
  finish_blocked "pulled artifact is empty: $ARTIFACT_LOCAL"
fi

# Step 6: Validate with the Core Python validator.
if [[ ! -f "$VALIDATOR" ]]; then
  finish_blocked "validator not found: $VALIDATOR"
fi

log "+ python3 $VALIDATOR $ARTIFACT_LOCAL"
set +e
python3 "$VALIDATOR" "$ARTIFACT_LOCAL" 2>&1 | tee -a "$LOG_FILE"
VALIDATOR_EXIT="${PIPESTATUS[0]}"
set -e
if [[ "$VALIDATOR_EXIT" != "0" ]]; then
  STATUS="FAIL"
  FAILURE="validator rejected artifact (exit $VALIDATOR_EXIT)"
  write_summary
  update_latest_pointer
  log "FAIL: validator rejected artifact"
  exit 1
fi

finish_pass
