#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HDC_BIN="${HDC_BIN:-hdc}"
TARGET="${HARMONYOS_REAL_DEVICE_TARGET:-${HARMONYOS_DEVICE_TARGET:-}}"
HAP_PATH="${HARMONYOS_REAL_DEVICE_HAP_PATH:-${HARMONYOS_HAP_PATH:-$ROOT_DIR/entry/build/default/outputs/default/entry-default-unsigned.hap}}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${HARMONYOS_REAL_DEVICE_PREFLIGHT_OUT:-$ROOT_DIR/artifacts/real-device-preflight/$STAMP}"
LATEST_DIR="$ROOT_DIR/artifacts/real-device-preflight/latest"
SUMMARY_FILE="$OUT_DIR/real_device_preflight_summary.json"
LOG_FILE="$OUT_DIR/real_device_preflight.log"
HDC_TARGETS_FILE="$OUT_DIR/hdc_targets.txt"
HDC_TARGETS_VERBOSE_FILE="$OUT_DIR/hdc_targets_verbose.txt"
HAP_LIST_FILE="$OUT_DIR/hap_listing.txt"
NAPI_SO_FILE="$OUT_DIR/libreader_core_napi.so"
NAPI_STRINGS_FILE="$OUT_DIR/libreader_core_napi.strings.txt"

SCHEMA_VERSION="harmonyos-real-device-preflight.v1"
BLOCKERS_JSON=""
BLOCKER_COUNT=0

mkdir -p "$OUT_DIR"

log() {
  printf '%s\n' "$*" | tee -a "$LOG_FILE"
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

add_blocker() {
  local message="$1"
  local escaped
  escaped="$(json_escape "$message")"
  if [[ -n "$BLOCKERS_JSON" ]]; then
    BLOCKERS_JSON+=", "
  fi
  BLOCKERS_JSON+="\"$escaped\""
  BLOCKER_COUNT=$((BLOCKER_COUNT + 1))
  log "BLOCKED: $message"
}

bool_json() {
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

sha256_file() {
  shasum -a 256 "$1" 2>/dev/null | awk '{print $1}'
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

json_string_array_from_lines() {
  local file="$1"
  local first=true
  printf '['
  if [[ -f "$file" ]]; then
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      if [[ "$first" == "true" ]]; then
        first=false
      else
        printf ', '
      fi
      printf '"%s"' "$(json_escape "$line")"
    done < "$file"
  fi
  printf ']'
}

contains_target() {
  local needle="$1"
  local file="$2"
  normalize_hdc_targets "$file" | grep -Fxq "$needle"
}

contains_string_token() {
  local token="$1"
  local file="$2"
  grep -Fq "$token" "$file" 2>/dev/null
}

check_source_token() {
  local file="$1"
  local token="$2"
  [[ -f "$file" ]] && grep -Fq "$token" "$file"
}

log "HarmonyOS real-device preflight started at $STAMP"
log "root=$ROOT_DIR"
log "hap=$HAP_PATH"

hdc_available=false
hdc_exit=-1
target_status="not_checked"
tier="none"

if command -v "$HDC_BIN" >/dev/null 2>&1; then
  hdc_available=true
  log "+ $HDC_BIN list targets"
  "$HDC_BIN" list targets > "$HDC_TARGETS_FILE" 2>&1
  hdc_exit=$?
  sed 's/^/  /' "$HDC_TARGETS_FILE" | tee -a "$LOG_FILE" >/dev/null
  log "+ $HDC_BIN list targets -v"
  "$HDC_BIN" list targets -v > "$HDC_TARGETS_VERBOSE_FILE" 2>&1
  sed 's/^/  /' "$HDC_TARGETS_VERBOSE_FILE" | tee -a "$LOG_FILE" >/dev/null
  if [[ "$hdc_exit" != "0" ]]; then
    add_blocker "hdc list targets exited $hdc_exit"
  fi
else
  add_blocker "hdc is unavailable; install DevEco/HarmonyOS command-line tools or set HDC_BIN"
fi

detected_targets=()
while IFS= read -r detected_target; do
  detected_targets+=("$detected_target")
done < <(normalize_hdc_targets "$HDC_TARGETS_FILE")
detected_target_count="${#detected_targets[@]}"
if [[ -z "$TARGET" ]]; then
  if [[ "$detected_target_count" == "1" ]]; then
    TARGET="${detected_targets[0]}"
  elif [[ "$detected_target_count" == "0" ]]; then
    target_status="missing"
    add_blocker "hdc list targets returned [Empty]; no physical real-device target is connected"
  else
    target_status="ambiguous"
    add_blocker "multiple hdc targets found; set HARMONYOS_REAL_DEVICE_TARGET to the physical device serial"
  fi
fi

if [[ -n "$TARGET" ]]; then
  if is_loopback_target "$TARGET"; then
    tier="simulator"
    target_status="simulator"
    add_blocker "target '$TARGET' is loopback/localhost and is simulator tier, not real-device tier"
  else
    tier="real-device-candidate"
    target_status="candidate"
  fi

  if [[ "$hdc_available" == "true" && "$hdc_exit" == "0" ]] && ! contains_target "$TARGET" "$HDC_TARGETS_FILE"; then
    target_status="missing"
    add_blocker "target '$TARGET' is not present in hdc list targets"
  fi
fi

repo_signing_configured=true
if grep -Eq '"signingConfigs"[[:space:]]*:[[:space:]]*\[[[:space:]]*\]' "$ROOT_DIR/build-profile.json5" 2>/dev/null; then
  repo_signing_configured=false
  add_blocker "build-profile.json5 has empty signingConfigs; a signed real-device HAP is not configured in this repo"
fi

hap_exists=false
hap_zip_ok=false
hap_signed_name=true
hap_size=0
hap_sha256="missing"
hap_napi_path=""
napi_symbols_ok=false
missing_napi_tokens_file="$OUT_DIR/missing_napi_tokens.txt"
: > "$missing_napi_tokens_file"

if [[ -f "$HAP_PATH" ]]; then
  hap_exists=true
  hap_size="$(wc -c < "$HAP_PATH" | tr -d ' ')"
  hap_sha256="$(sha256_file "$HAP_PATH")"
  if [[ "$(basename "$HAP_PATH" | tr '[:upper:]' '[:lower:]')" == *unsigned* ]]; then
    hap_signed_name=false
    add_blocker "HAP artifact name indicates unsigned output: $HAP_PATH"
  fi
  if command -v unzip >/dev/null 2>&1; then
    log "+ unzip -l $HAP_PATH"
    unzip -l "$HAP_PATH" > "$HAP_LIST_FILE" 2>&1
    if [[ "$?" == "0" ]]; then
      hap_zip_ok=true
      hap_napi_path="$(awk '{print $4}' "$HAP_LIST_FILE" | grep -E '(^|/)libreader_core_napi\.so$' | head -n 1 || true)"
      if [[ -z "$hap_napi_path" ]]; then
        add_blocker "HAP does not contain libreader_core_napi.so"
      else
        unzip -p "$HAP_PATH" "$hap_napi_path" > "$NAPI_SO_FILE" 2>/dev/null
      fi
    else
      add_blocker "HAP is not readable by unzip: $HAP_PATH"
    fi
  else
    add_blocker "unzip is unavailable; cannot inspect HAP contents"
  fi
else
  add_blocker "HAP artifact is missing: $HAP_PATH"
fi

if [[ -s "$NAPI_SO_FILE" ]]; then
  if command -v strings >/dev/null 2>&1; then
    strings "$NAPI_SO_FILE" > "$NAPI_STRINGS_FILE" 2>/dev/null
  else
    LC_ALL=C grep -a -o '[[:print:]]\{4,\}' "$NAPI_SO_FILE" > "$NAPI_STRINGS_FILE" 2>/dev/null
  fi
  required_napi_tokens=(
    "abiVersion"
    "createRuntime"
    "releaseRuntime"
    "sendCommand"
    "cancelRequest"
    "readEvent"
    "pendingEventCount"
    "completeHostRequest"
    "failHostRequest"
    "pingSmoke"
    "hostSmoke"
    "lifecycleSmoke"
    "sendJsonCommand"
    "runtime.hostSmoke"
    "host.complete"
    "host.error"
  )
  for token in "${required_napi_tokens[@]}"; do
    if ! contains_string_token "$token" "$NAPI_STRINGS_FILE"; then
      printf '%s\n' "$token" >> "$missing_napi_tokens_file"
    fi
  done
  if [[ -s "$missing_napi_tokens_file" ]]; then
    add_blocker "NAPI library is missing required runtime/HostBus tokens; see $missing_napi_tokens_file"
  else
    napi_symbols_ok=true
  fi
fi

host_bus_source_ok=true
if ! check_source_token "$ROOT_DIR/entry/src/main/ets/cabi/ReaderCoreNapiBridge.ets" "export function runHostSmokeClosedLoop"; then
  host_bus_source_ok=false
  add_blocker "ReaderCoreNapiBridge.ets does not expose runHostSmokeClosedLoop"
fi
if ! check_source_token "$ROOT_DIR/entry/src/main/ets/pages/Index.ets" "runHostSmokeClosedLoop"; then
  host_bus_source_ok=false
  add_blocker "Runtime panel does not call runHostSmokeClosedLoop"
fi
if ! check_source_token "$ROOT_DIR/entry/src/main/ets/pages/Index.ets" "HostBus"; then
  host_bus_source_ok=false
  add_blocker "Runtime panel does not expose the HostBus smoke pill"
fi

status="READY"
exit_code=0
if [[ "$BLOCKER_COUNT" != "0" ]]; then
  status="BLOCKED"
  exit_code=3
fi

generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
{
  printf '{\n'
  printf '  "schemaVersion": "%s",\n' "$SCHEMA_VERSION"
  printf '  "status": "%s",\n' "$status"
  printf '  "generatedAt": "%s",\n' "$generated_at"
  printf '  "blockers": [%s],\n' "$BLOCKERS_JSON"
  printf '  "repo": {\n'
  printf '    "branch": "%s",\n' "$(json_escape "$(repo_branch)")"
  printf '    "head": "%s",\n' "$(json_escape "$(repo_head)")"
  printf '    "dirty": %s\n' "$(repo_dirty)"
  printf '  },\n'
  printf '  "hdc": {\n'
  printf '    "bin": "%s",\n' "$(json_escape "$HDC_BIN")"
  printf '    "available": %s,\n' "$(bool_json "$hdc_available")"
  printf '    "listTargetsExit": %s,\n' "$hdc_exit"
  printf '    "detectedTargets": '
  json_string_array_from_lines <(normalize_hdc_targets "$HDC_TARGETS_FILE")
  printf ',\n'
  printf '    "rawTargetsFile": "%s",\n' "$(json_escape "$HDC_TARGETS_FILE")"
  printf '    "verboseTargetsFile": "%s"\n' "$(json_escape "$HDC_TARGETS_VERBOSE_FILE")"
  printf '  },\n'
  printf '  "target": {\n'
  printf '    "requested": "%s",\n' "$(json_escape "$TARGET")"
  printf '    "status": "%s",\n' "$(json_escape "$target_status")"
  printf '    "tier": "%s",\n' "$(json_escape "$tier")"
  printf '    "tierRule": "127.0.0.1/localhost => simulator; any other present hdc target => real-device candidate"\n'
  printf '  },\n'
  printf '  "hap": {\n'
  printf '    "path": "%s",\n' "$(json_escape "$HAP_PATH")"
  printf '    "exists": %s,\n' "$(bool_json "$hap_exists")"
  printf '    "zipReadable": %s,\n' "$(bool_json "$hap_zip_ok")"
  printf '    "repoSigningConfigured": %s,\n' "$(bool_json "$repo_signing_configured")"
  printf '    "signedNameCheck": %s,\n' "$(bool_json "$hap_signed_name")"
  printf '    "sizeBytes": %s,\n' "$hap_size"
  printf '    "sha256": "%s",\n' "$(json_escape "$hap_sha256")"
  printf '    "napiLibraryPath": "%s",\n' "$(json_escape "$hap_napi_path")"
  printf '    "listingFile": "%s"\n' "$(json_escape "$HAP_LIST_FILE")"
  printf '  },\n'
  printf '  "napi": {\n'
  printf '    "symbolsOk": %s,\n' "$(bool_json "$napi_symbols_ok")"
  printf '    "stringsFile": "%s",\n' "$(json_escape "$NAPI_STRINGS_FILE")"
  printf '    "missingTokensFile": "%s"\n' "$(json_escape "$missing_napi_tokens_file")"
  printf '  },\n'
  printf '  "hostBusSmoke": {\n'
  printf '    "sourceEntryOk": %s,\n' "$(bool_json "$host_bus_source_ok")"
  printf '    "runtimeSmokeCommand": "HARMONYOS_DEVICE_TARGET=<physical-target> HARMONYOS_HAP_PATH=<signed-hap> scripts/run_device_runtime_smoke.sh",\n'
  printf '    "expectedRuntimeSummaryTier": "device",\n'
  printf '    "requiredRuntimeToken": "HostBus + PASS op:"\n'
  printf '  },\n'
  printf '  "artifacts": {\n'
  printf '    "summary": "%s",\n' "$(json_escape "$SUMMARY_FILE")"
  printf '    "log": "%s"\n' "$(json_escape "$LOG_FILE")"
  printf '  }\n'
  printf '}\n'
} > "$SUMMARY_FILE"

if [[ "$OUT_DIR" != "$LATEST_DIR" ]]; then
  mkdir -p "$(dirname "$LATEST_DIR")"
  ln -sfn "$OUT_DIR" "$LATEST_DIR"
fi

log "summary=$SUMMARY_FILE"
log "status=$status"
exit "$exit_code"
