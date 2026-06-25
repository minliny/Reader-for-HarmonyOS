#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${HARMONYOS_SIGNED_HAP_OUT:-$ROOT_DIR/artifacts/signed-hap/$STAMP}"
LATEST_DIR="$ROOT_DIR/artifacts/signed-hap/latest"
SUMMARY_FILE="$OUT_DIR/signed_hap_summary.json"
LOG_FILE="$OUT_DIR/signed_hap_build.log"
BUILD_PROFILE="$ROOT_DIR/build-profile.json5"
ORIGINAL_PROFILE="$OUT_DIR/build-profile.original.json5"
PATCHED_PROFILE="$OUT_DIR/build-profile.signed.json5"
BUILD_MARKER="$OUT_DIR/build-start.marker"

SIGNING_CONFIG_NAME="${HARMONYOS_SIGNING_CONFIG_NAME:-default}"
SIGNING_TYPE="${HARMONYOS_SIGNING_TYPE:-HarmonyOS}"
SIGN_ALG="${HARMONYOS_SIGNING_SIGN_ALG:-SHA256withECDSA}"
STORE_FILE="${HARMONYOS_SIGNING_STORE_FILE:-}"
STORE_PASSWORD="${HARMONYOS_SIGNING_STORE_PASSWORD:-}"
KEY_ALIAS="${HARMONYOS_SIGNING_KEY_ALIAS:-}"
KEY_PASSWORD="${HARMONYOS_SIGNING_KEY_PASSWORD:-}"
PROFILE_FILE="${HARMONYOS_SIGNING_PROFILE:-}"
CERT_PATH="${HARMONYOS_SIGNING_CERT_PATH:-}"
USE_EXISTING_SIGNING_CONFIG="${HARMONYOS_USE_EXISTING_SIGNING_CONFIG:-false}"
OVERWRITE_SIGNING_CONFIG="${HARMONYOS_SIGNING_OVERWRITE:-false}"
KEEP_BUILD_PROFILE="${HARMONYOS_SIGNING_KEEP_BUILD_PROFILE:-false}"
SIGNED_HAP_NAME="${HARMONYOS_SIGNED_HAP_NAME:-entry-default-signed.hap}"

SCHEMA_VERSION="harmonyos-signed-hap-build.v1"
BLOCKERS=()
STATUS="BLOCKED"
FAILURE=""
BUILD_EXIT=-1
PATCHED_BUILD_PROFILE=false
SOURCE_HAP=""
SIGNED_HAP_PATH=""
SIGNED_HAP_SIZE=0
SIGNED_HAP_SHA256="missing"

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

bool_from_test() {
  if "$@"; then
    printf 'true'
  else
    printf 'false'
  fi
}

sha256_file() {
  shasum -a 256 "$1" 2>/dev/null | awk '{print $1}'
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

material_sha_or_missing() {
  local path="$1"
  if [[ -f "$path" ]]; then
    sha256_file "$path"
  else
    printf 'missing'
  fi
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
    printf '  "signing": {\n'
    printf '    "mode": "%s",\n' "$(json_escape "$([ "$USE_EXISTING_SIGNING_CONFIG" = "true" ] && printf existing || printf env-patch)")"
    printf '    "configName": "%s",\n' "$(json_escape "$SIGNING_CONFIG_NAME")"
    printf '    "type": "%s",\n' "$(json_escape "$SIGNING_TYPE")"
    printf '    "signAlg": "%s",\n' "$(json_escape "$SIGN_ALG")"
    printf '    "patchedBuildProfile": %s,\n' "$(json_bool "$PATCHED_BUILD_PROFILE")"
    printf '    "keptBuildProfile": %s,\n' "$(json_bool "$KEEP_BUILD_PROFILE")"
    printf '    "material": {\n'
    printf '      "storeFile": "%s",\n' "$(json_escape "$STORE_FILE")"
    printf '      "storeFileExists": %s,\n' "$(bool_from_test test -f "$STORE_FILE")"
    printf '      "storeFileSha256": "%s",\n' "$(json_escape "$(material_sha_or_missing "$STORE_FILE")")"
    printf '      "storePasswordProvided": %s,\n' "$([ -n "$STORE_PASSWORD" ] && printf true || printf false)"
    printf '      "keyAlias": "%s",\n' "$(json_escape "$KEY_ALIAS")"
    printf '      "keyPasswordProvided": %s,\n' "$([ -n "$KEY_PASSWORD" ] && printf true || printf false)"
    printf '      "profile": "%s",\n' "$(json_escape "$PROFILE_FILE")"
    printf '      "profileExists": %s,\n' "$(bool_from_test test -f "$PROFILE_FILE")"
    printf '      "profileSha256": "%s",\n' "$(json_escape "$(material_sha_or_missing "$PROFILE_FILE")")"
    printf '      "certpath": "%s",\n' "$(json_escape "$CERT_PATH")"
    printf '      "certpathExists": %s,\n' "$(bool_from_test test -f "$CERT_PATH")"
    printf '      "certpathSha256": "%s"\n' "$(json_escape "$(material_sha_or_missing "$CERT_PATH")")"
    printf '    }\n'
    printf '  },\n'
    printf '  "build": {\n'
    printf '    "exitCode": %s,\n' "$BUILD_EXIT"
    printf '    "log": "%s"\n' "$(json_escape "$LOG_FILE")"
    printf '  },\n'
    printf '  "hap": {\n'
    printf '    "sourcePath": "%s",\n' "$(json_escape "$SOURCE_HAP")"
    printf '    "path": "%s",\n' "$(json_escape "$SIGNED_HAP_PATH")"
    printf '    "sizeBytes": %s,\n' "$SIGNED_HAP_SIZE"
    printf '    "sha256": "%s"\n' "$(json_escape "$SIGNED_HAP_SHA256")"
    printf '  },\n'
    printf '  "artifacts": {\n'
    printf '    "summary": "%s",\n' "$(json_escape "$SUMMARY_FILE")"
    printf '    "originalBuildProfile": "%s",\n' "$(json_escape "$ORIGINAL_PROFILE")"
    printf '    "patchedBuildProfile": "%s"\n' "$(json_escape "$PATCHED_PROFILE")"
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

restore_build_profile() {
  if [[ "$PATCHED_BUILD_PROFILE" == "true" && "$KEEP_BUILD_PROFILE" != "true" && -f "$ORIGINAL_PROFILE" ]]; then
    cp "$ORIGINAL_PROFILE" "$BUILD_PROFILE"
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

signing_configs_empty() {
  grep -Eq '"signingConfigs"[[:space:]]*:[[:space:]]*\[[[:space:]]*\]' "$BUILD_PROFILE" 2>/dev/null
}

signing_configs_present() {
  grep -Eq '"signingConfigs"[[:space:]]*:' "$BUILD_PROFILE" 2>/dev/null
}

patch_build_profile() {
  cp "$BUILD_PROFILE" "$ORIGINAL_PROFILE"
  python3 - "$BUILD_PROFILE" "$PATCHED_PROFILE" <<'PY'
import json
import os
import re
import sys
from pathlib import Path

source = Path(sys.argv[1])
target = Path(sys.argv[2])
text = source.read_text(encoding="utf-8")
overwrite = os.environ.get("HARMONYOS_SIGNING_OVERWRITE") == "true"

material = {
    "storeFile": os.environ["HARMONYOS_SIGNING_STORE_FILE"],
    "storePassword": os.environ["HARMONYOS_SIGNING_STORE_PASSWORD"],
    "keyAlias": os.environ["HARMONYOS_SIGNING_KEY_ALIAS"],
    "keyPassword": os.environ["HARMONYOS_SIGNING_KEY_PASSWORD"],
    "signAlg": os.environ.get("HARMONYOS_SIGNING_SIGN_ALG", "SHA256withECDSA"),
    "profile": os.environ["HARMONYOS_SIGNING_PROFILE"],
}
certpath = os.environ.get("HARMONYOS_SIGNING_CERT_PATH", "")
if certpath:
    material["certpath"] = certpath

def dump(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)

material_lines = []
for key, value in material.items():
    material_lines.append(f'        "{key}": {dump(value)}')
material_block = ",\n".join(material_lines)
block = (
    '"signingConfigs": [\n'
    "      {\n"
    f'        "name": {dump(os.environ.get("HARMONYOS_SIGNING_CONFIG_NAME", "default"))},\n'
    f'        "type": {dump(os.environ.get("HARMONYOS_SIGNING_TYPE", "HarmonyOS"))},\n'
    "        \"material\": {\n"
    f"{material_block}\n"
    "        }\n"
    "      }\n"
    "    ]"
)

empty_pattern = re.compile(r'"signingConfigs"\s*:\s*\[\s*\]')
if empty_pattern.search(text):
    patched = empty_pattern.sub(block, text, count=1)
elif overwrite:
    broad_pattern = re.compile(r'"signingConfigs"\s*:\s*\[[\s\S]*?\](?=\s*,\s*"products")')
    patched, count = broad_pattern.subn(block, text, count=1)
    if count != 1:
        raise SystemExit("unable to replace signingConfigs in build-profile.json5")
else:
    raise SystemExit("build-profile.json5 already has signingConfigs; set HARMONYOS_USE_EXISTING_SIGNING_CONFIG=true or HARMONYOS_SIGNING_OVERWRITE=true")

target.write_text(patched, encoding="utf-8")
PY
  if [[ "$?" != "0" ]]; then
    add_blocker "failed to generate signed build-profile.json5"
    return 1
  fi
  cp "$PATCHED_PROFILE" "$BUILD_PROFILE"
  PATCHED_BUILD_PROFILE=true
}

find_signed_hap() {
  local hap
  SOURCE_HAP=""
  while IFS= read -r hap; do
    SOURCE_HAP="$hap"
  done < <(find "$ROOT_DIR/entry/build" -type f -name '*.hap' ! -iname '*unsigned*' -newer "$BUILD_MARKER" -print 2>/dev/null | sort)
  [[ -n "$SOURCE_HAP" ]]
}

log "HarmonyOS signed HAP build started at $STAMP"
log "root=$ROOT_DIR"
log "out=$OUT_DIR"

if [[ ! -f "$BUILD_PROFILE" ]]; then
  add_blocker "missing build-profile.json5"
  finish_blocked "missing build-profile.json5"
fi

if [[ "$USE_EXISTING_SIGNING_CONFIG" == "true" ]]; then
  if signing_configs_empty || ! signing_configs_present; then
    add_blocker "HARMONYOS_USE_EXISTING_SIGNING_CONFIG=true but build-profile.json5 has no signing config"
  fi
else
  [[ -n "$STORE_FILE" ]] || add_blocker "missing HARMONYOS_SIGNING_STORE_FILE"
  [[ -n "$STORE_PASSWORD" ]] || add_blocker "missing HARMONYOS_SIGNING_STORE_PASSWORD"
  [[ -n "$KEY_ALIAS" ]] || add_blocker "missing HARMONYOS_SIGNING_KEY_ALIAS"
  [[ -n "$KEY_PASSWORD" ]] || add_blocker "missing HARMONYOS_SIGNING_KEY_PASSWORD"
  [[ -n "$PROFILE_FILE" ]] || add_blocker "missing HARMONYOS_SIGNING_PROFILE"
  [[ -z "$STORE_FILE" || -f "$STORE_FILE" ]] || add_blocker "HARMONYOS_SIGNING_STORE_FILE does not exist: $STORE_FILE"
  [[ -z "$PROFILE_FILE" || -f "$PROFILE_FILE" ]] || add_blocker "HARMONYOS_SIGNING_PROFILE does not exist: $PROFILE_FILE"
  [[ -z "$CERT_PATH" || -f "$CERT_PATH" ]] || add_blocker "HARMONYOS_SIGNING_CERT_PATH does not exist: $CERT_PATH"
  if signing_configs_present && ! signing_configs_empty && [[ "$OVERWRITE_SIGNING_CONFIG" != "true" ]]; then
    add_blocker "build-profile.json5 already has signingConfigs; set HARMONYOS_USE_EXISTING_SIGNING_CONFIG=true or HARMONYOS_SIGNING_OVERWRITE=true"
  fi
fi

if [[ "${#BLOCKERS[@]}" != "0" ]]; then
  finish_blocked "signing prerequisites are incomplete"
fi

trap 'restore_build_profile' EXIT

if [[ "$USE_EXISTING_SIGNING_CONFIG" != "true" ]]; then
  if ! patch_build_profile; then
    finish_blocked "unable to patch build-profile.json5"
  fi
fi

if [[ -z "${JAVA_HOME:-}" && -d "/Applications/DevEco-Studio.app/Contents/jbr/Contents/Home" ]]; then
  export JAVA_HOME="/Applications/DevEco-Studio.app/Contents/jbr/Contents/Home"
fi
if [[ -z "${DEVECO_SDK_HOME:-}" && -d "/Applications/DevEco-Studio.app/Contents" ]]; then
  export DEVECO_SDK_HOME="/Applications/DevEco-Studio.app/Contents"
fi

log "+ $ROOT_DIR/hvigorw assembleHap --no-daemon"
touch "$BUILD_MARKER"
set +e
(cd "$ROOT_DIR" && ./hvigorw assembleHap --no-daemon) 2>&1 | tee -a "$LOG_FILE"
BUILD_EXIT="${PIPESTATUS[0]}"
set -e

if [[ "$BUILD_EXIT" != "0" ]]; then
  finish_failed "hvigor assembleHap failed"
fi

if ! find_signed_hap; then
  add_blocker "hvigor did not produce a non-unsigned HAP under entry/build"
  finish_blocked "signed HAP artifact not found"
fi

SIGNED_HAP_PATH="$OUT_DIR/$SIGNED_HAP_NAME"
cp "$SOURCE_HAP" "$SIGNED_HAP_PATH"
SIGNED_HAP_SIZE="$(wc -c < "$SIGNED_HAP_PATH" | tr -d ' ')"
SIGNED_HAP_SHA256="$(sha256_file "$SIGNED_HAP_PATH")"

if [[ "$(basename "$SIGNED_HAP_PATH" | tr '[:upper:]' '[:lower:]')" == *unsigned* ]]; then
  add_blocker "copied HAP still has unsigned in its filename: $SIGNED_HAP_PATH"
  finish_blocked "signed HAP artifact name is not acceptable"
fi

STATUS="PASS"
FAILURE=""
write_summary
update_latest_pointer
log "signed_hap=$SIGNED_HAP_PATH"
log "summary=$SUMMARY_FILE"
log "status=$STATUS"
