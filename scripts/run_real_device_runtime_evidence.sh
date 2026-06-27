#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HDC_BIN="${HDC_BIN:-hdc}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${HARMONYOS_REAL_DEVICE_EVIDENCE_OUT:-$ROOT_DIR/artifacts/real-device-runtime/$STAMP}"
LATEST_DIR="$ROOT_DIR/artifacts/real-device-runtime/latest"
SUMMARY_FILE="$OUT_DIR/real_device_runtime_evidence_summary.json"
LOG_FILE="$OUT_DIR/real_device_runtime_evidence.log"
TARGET="${HARMONYOS_REAL_DEVICE_TARGET:-${HARMONYOS_DEVICE_TARGET:-}}"
HAP_PATH="${HARMONYOS_REAL_DEVICE_HAP_PATH:-${HARMONYOS_HAP_PATH:-}}"

SCHEMA_VERSION="harmonyos-real-device-runtime-evidence.v1"
BLOCKERS=()
STATUS="BLOCKED"
FAILURE=""
PREFLIGHT_EXIT=-1
RUNTIME_EXIT=-1
VALIDATOR_EXIT=-1
PREFLIGHT_SUMMARY="$OUT_DIR/preflight/real_device_preflight_summary.json"
RUNTIME_SUMMARY="$OUT_DIR/device-runtime-smoke/device_runtime_smoke_summary.json"
SIGNED_HAP_SUMMARY="$OUT_DIR/signed-hap/signed_hap_summary.json"

mkdir -p "$OUT_DIR"

log() {
  printf '%s\n' "$*" | tee -a "$LOG_FILE"
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

json_bool() {
  if [[ "$1" == "true" ]]; then
    printf 'true'
  else
    printf 'false'
  fi
}

repo_head() {
  git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || printf 'unknown'
}

repo_branch() {
  git -C "$ROOT_DIR" branch --show-current 2>/dev/null || printf 'unknown'
}

repo_dirty() {
  if git -C "$ROOT_DIR" status --porcelain --untracked-files=normal 2>/dev/null | grep -q .; then
    printf 'true'
  else
    printf 'false'
  fi
}

add_blocker() {
  local message="$1"
  BLOCKERS+=("$message")
  log "BLOCKED: $message"
}

blockers_json() {
  local first=true
  printf '['
  for blocker in "${BLOCKERS[@]}"; do
    if [[ "$first" == "true" ]]; then
      first=false
    else
      printf ', '
    fi
    printf '"%s"' "$(json_escape "$blocker")"
  done
  printf ']'
}

is_loopback_target() {
  local target="$1"
  [[ "$target" =~ ^(127\.|localhost)(:|$) ]]
}

normalize_hdc_targets() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    return 0
  fi
  grep -Ev '^[[:space:]]*$|^\[Empty\]$' "$file" |
    sed -E 's/^[[:space:]]+//; s/[[:space:]].*$//' |
    grep -Ev '^\[.*\]$' || true
}

has_signing_env() {
  [[ -n "${HARMONYOS_SIGNING_STORE_FILE:-}" &&
    -n "${HARMONYOS_SIGNING_STORE_PASSWORD:-}" &&
    -n "${HARMONYOS_SIGNING_KEY_ALIAS:-}" &&
    -n "${HARMONYOS_SIGNING_KEY_PASSWORD:-}" &&
    -n "${HARMONYOS_SIGNING_PROFILE:-}" ]]
}

write_summary() {
  local generated_at
  generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  {
    printf '{\n'
    printf '  "schemaVersion": "%s",\n' "$SCHEMA_VERSION"
    printf '  "status": "%s",\n' "$STATUS"
    printf '  "failure": "%s",\n' "$(json_escape "$FAILURE")"
    printf '  "generatedAt": "%s",\n' "$generated_at"
    printf '  "blockers": '
    blockers_json
    printf ',\n'
    printf '  "repo": {\n'
    printf '    "branch": "%s",\n' "$(json_escape "$(repo_branch)")"
    printf '    "head": "%s",\n' "$(json_escape "$(repo_head)")"
    printf '    "dirty": %s\n' "$(repo_dirty)"
    printf '  },\n'
    printf '  "target": "%s",\n' "$(json_escape "$TARGET")"
    printf '  "targetIsLoopback": %s,\n' "$(is_loopback_target "$TARGET" && printf true || printf false)"
    printf '  "hap": {\n'
    printf '    "path": "%s",\n' "$(json_escape "$HAP_PATH")"
    printf '    "exists": %s,\n' "$([ -f "$HAP_PATH" ] && printf true || printf false)"
    printf '    "nameIndicatesUnsigned": %s\n' "$([[ "$(basename "$HAP_PATH" 2>/dev/null | tr '[:upper:]' '[:lower:]')" == *unsigned* ]] && printf true || printf false)"
    printf '  },\n'
    printf '  "steps": {\n'
    printf '    "signedHapSummary": "%s",\n' "$(json_escape "$SIGNED_HAP_SUMMARY")"
    printf '    "preflightExit": %s,\n' "$PREFLIGHT_EXIT"
    printf '    "preflightSummary": "%s",\n' "$(json_escape "$PREFLIGHT_SUMMARY")"
    printf '    "runtimeExit": %s,\n' "$RUNTIME_EXIT"
    printf '    "runtimeSummary": "%s",\n' "$(json_escape "$RUNTIME_SUMMARY")"
    printf '    "validatorExit": %s\n' "$VALIDATOR_EXIT"
    printf '  },\n'
    printf '  "artifacts": {\n'
    printf '    "summary": "%s",\n' "$(json_escape "$SUMMARY_FILE")"
    printf '    "log": "%s"\n' "$(json_escape "$LOG_FILE")"
    printf '  }\n'
    printf '}\n'
  } > "$SUMMARY_FILE"
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
  log "summary=$SUMMARY_FILE"
  log "status=$STATUS"
  exit 3
}

finish_failed() {
  STATUS="FAIL"
  FAILURE="$1"
  write_summary
  update_latest_pointer
  log "summary=$SUMMARY_FILE"
  log "status=$STATUS"
  exit 1
}

finish_pass() {
  STATUS="PASS"
  FAILURE=""
  write_summary
  update_latest_pointer
  log "summary=$SUMMARY_FILE"
  log "status=$STATUS"
}

detect_target_if_possible() {
  local target_file="$OUT_DIR/hdc_targets.txt"
  local non_loopback_file="$OUT_DIR/hdc_non_loopback_targets.txt"
  if [[ -n "$TARGET" ]]; then
    return 0
  fi
  if ! command -v "$HDC_BIN" >/dev/null 2>&1; then
    add_blocker "hdc is unavailable; install DevEco/HarmonyOS command-line tools or set HDC_BIN"
    return 1
  fi
  log "+ $HDC_BIN list targets"
  "$HDC_BIN" list targets > "$target_file" 2>&1
  normalize_hdc_targets "$target_file" | grep -Ev '^(127\.|localhost)(:|$)' > "$non_loopback_file" || true
  local count
  count="$(wc -l < "$non_loopback_file" | tr -d ' ')"
  if [[ "$count" == "1" ]]; then
    TARGET="$(sed -n '1p' "$non_loopback_file")"
    log "selected physical target candidate=$TARGET"
  elif [[ "$count" == "0" ]]; then
    add_blocker "no non-loopback hdc target detected; connect a physical device or set HARMONYOS_REAL_DEVICE_TARGET"
    return 1
  else
    add_blocker "multiple non-loopback hdc targets detected; set HARMONYOS_REAL_DEVICE_TARGET explicitly"
    return 1
  fi
}

build_signed_hap_if_needed() {
  if [[ -n "$HAP_PATH" ]]; then
    return 0
  fi
  if [[ "${HARMONYOS_USE_EXISTING_SIGNING_CONFIG:-false}" != "true" ]] && ! has_signing_env; then
    add_blocker "missing signed HAP path and signing env; set HARMONYOS_REAL_DEVICE_HAP_PATH or HARMONYOS_SIGNING_*"
    return 1
  fi
  log "+ scripts/build_signed_hap.sh"
  set +e
  HARMONYOS_SIGNED_HAP_OUT="$OUT_DIR/signed-hap" bash "$ROOT_DIR/scripts/build_signed_hap.sh" 2>&1 | tee -a "$LOG_FILE"
  local build_exit="${PIPESTATUS[0]}"
  set -e
  if [[ "$build_exit" != "0" ]]; then
    add_blocker "signed HAP build failed or blocked; see $SIGNED_HAP_SUMMARY"
    return 1
  fi
  HAP_PATH="$(python3 - "$SIGNED_HAP_SUMMARY" <<'PY'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
if path.is_file():
    print(json.loads(path.read_text(encoding="utf-8")).get("hap", {}).get("path", ""))
PY
)"
  if [[ -z "$HAP_PATH" ]]; then
    add_blocker "signed HAP summary did not contain hap.path"
    return 1
  fi
}

log "HarmonyOS real-device runtime evidence started at $STAMP"
log "root=$ROOT_DIR"
log "out=$OUT_DIR"

detect_target_if_possible || true
if [[ -n "$TARGET" && "$(is_loopback_target "$TARGET" && printf true || printf false)" == "true" ]]; then
  add_blocker "target '$TARGET' is loopback/localhost and cannot be used as real-device evidence"
fi

build_signed_hap_if_needed || true
if [[ -n "$HAP_PATH" && ! -f "$HAP_PATH" ]]; then
  add_blocker "HAP path does not exist: $HAP_PATH"
fi
if [[ -n "$HAP_PATH" && "$(basename "$HAP_PATH" | tr '[:upper:]' '[:lower:]')" == *unsigned* ]]; then
  add_blocker "HAP path indicates unsigned output: $HAP_PATH"
fi

if [[ "${#BLOCKERS[@]}" != "0" ]]; then
  finish_blocked "real-device prerequisites are incomplete"
fi

log "+ scripts/preflight_real_device_runtime_smoke.sh"
set +e
HARMONYOS_REAL_DEVICE_PREFLIGHT_OUT="$OUT_DIR/preflight" \
HARMONYOS_REAL_DEVICE_TARGET="$TARGET" \
HARMONYOS_REAL_DEVICE_HAP_PATH="$HAP_PATH" \
bash "$ROOT_DIR/scripts/preflight_real_device_runtime_smoke.sh" 2>&1 | tee -a "$LOG_FILE"
PREFLIGHT_EXIT="${PIPESTATUS[0]}"
set -e
if [[ "$PREFLIGHT_EXIT" != "0" ]]; then
  finish_blocked "real-device preflight blocked"
fi

log "+ scripts/run_device_runtime_smoke.sh"
set +e
HARMONYOS_DEVICE_SMOKE_OUT="$OUT_DIR/device-runtime-smoke" \
HARMONYOS_DEVICE_TARGET="$TARGET" \
HARMONYOS_HAP_PATH="$HAP_PATH" \
HARMONYOS_REQUIRE_REAL_DEVICE=true \
HARMONYOS_REQUIRE_SIGNED_HAP=true \
bash "$ROOT_DIR/scripts/run_device_runtime_smoke.sh" 2>&1 | tee -a "$LOG_FILE"
RUNTIME_EXIT="${PIPESTATUS[0]}"
set -e
if [[ "$RUNTIME_EXIT" != "0" ]]; then
  finish_failed "real-device runtime smoke failed"
fi

log "+ scripts/validate_real_device_runtime_smoke_artifact.py"
set +e
python3 "$ROOT_DIR/scripts/validate_real_device_runtime_smoke_artifact.py" "$RUNTIME_SUMMARY" 2>&1 | tee -a "$LOG_FILE"
VALIDATOR_EXIT="${PIPESTATUS[0]}"
set -e
if [[ "$VALIDATOR_EXIT" != "0" ]]; then
  finish_failed "real-device runtime validator failed"
fi

finish_pass
