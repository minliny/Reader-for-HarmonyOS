#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${HARMONYOS_DEVICE_TARGET:-127.0.0.1:5555}"
BUNDLE="${HARMONYOS_BUNDLE:-com.reader.harmonyos}"
MODULE="${HARMONYOS_MODULE:-entry}"
ABILITY="${HARMONYOS_ABILITY:-EntryAbility}"
HDC_BIN="${HDC_BIN:-hdc}"
CLICK_X="${HARMONYOS_RUNTIME_PANEL_CLICK_X:-1060}"
CLICK_Y="${HARMONYOS_RUNTIME_PANEL_CLICK_Y:-230}"
RUNTIME_WAIT_SECONDS="${HARMONYOS_RUNTIME_WAIT_SECONDS:-240}"
RUNTIME_POLL_INTERVAL_SECONDS="${HARMONYOS_RUNTIME_POLL_INTERVAL_SECONDS:-5}"
PROCESS_WAIT_SECONDS="${HARMONYOS_PROCESS_WAIT_SECONDS:-30}"
PROCESS_POLL_INTERVAL_SECONDS="${HARMONYOS_PROCESS_POLL_INTERVAL_SECONDS:-2}"
RUNTIME_PROXY_MODE="${HARMONYOS_RUNTIME_PROXY_MODE:-auto}"
RUNTIME_PROXY_URL="${HARMONYOS_RUNTIME_PROXY_URL:-}"
RUNTIME_PROXY_HOST="${HARMONYOS_RUNTIME_PROXY_HOST:-}"
RUNTIME_PROXY_PORT="${HARMONYOS_RUNTIME_PROXY_PORT:-}"
LOCAL_HTTP_MODE="${HARMONYOS_LOCAL_HTTP_MODE:-on}"
LOCAL_HTTP_BIND_HOST="${HARMONYOS_LOCAL_HTTP_BIND_HOST:-127.0.0.1}"
LOCAL_HTTP_DEVICE_HOST="${HARMONYOS_LOCAL_HTTP_DEVICE_HOST:-10.0.2.2}"
LOCAL_HTTP_PORT="${HARMONYOS_LOCAL_HTTP_PORT:-}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${HARMONYOS_DEVICE_SMOKE_OUT:-$ROOT_DIR/artifacts/device-runtime-smoke/$STAMP}"
HAP_PATH="${HARMONYOS_HAP_PATH:-$ROOT_DIR/entry/build/default/outputs/default/entry-default-unsigned.hap}"
SCHEMA_VERSION="device-runtime-smoke.v1"
CI_GATE_NAME="harmonyos_device_runtime_ci"
LATEST_DIR="$ROOT_DIR/artifacts/device-runtime-smoke/latest"

REMOTE_HOME="/data/local/tmp/reader_harmonyos_home_layout.json"
REMOTE_RUNTIME="/data/local/tmp/reader_runtime_layout.json"
REMOTE_SCREENSHOT="/data/local/tmp/reader_runtime_panel.jpeg"
HOME_LAYOUT="$OUT_DIR/home_layout.json"
RUNTIME_LAYOUT="$OUT_DIR/runtime_layout.json"
SCREENSHOT="$OUT_DIR/runtime_panel.jpeg"
LOG_FILE="$OUT_DIR/device_runtime_smoke.log"
SUMMARY_FILE="$OUT_DIR/device_runtime_smoke_summary.json"
JUNIT_FILE="$OUT_DIR/device_runtime_smoke.junit.xml"
LOCAL_HTTP_ROOT="$OUT_DIR/local_http_root"
LOCAL_HTTP_LOG="$OUT_DIR/local_http_server.log"

mkdir -p "$OUT_DIR"

log() {
  printf '%s\n' "$*" | tee -a "$LOG_FILE"
}

run() {
  log "+ $*"
  "$@" 2>&1 | tee -a "$LOG_FILE"
}

hdc_command_index=0
LAST_HDC_OUTPUT_FILE=""

run_hdc() {
  hdc_command_index=$((hdc_command_index + 1))
  local command_output="$OUT_DIR/hdc_command_${hdc_command_index}.log"
  LAST_HDC_OUTPUT_FILE="$command_output"
  log "+ $*"
  set +e
  "$@" 2>&1 | tee "$command_output" | tee -a "$LOG_FILE"
  local statuses=("${PIPESTATUS[@]}")
  set -e
  local command_status="${statuses[0]}"
  if [[ "$command_status" != "0" ]]; then
    failure="hdc command exited $command_status: $*"
    return "$command_status"
  fi
  if grep -Fq "[Fail]" "$command_output"; then
    failure="hdc command reported failure: $*"
    return 1
  fi
  if grep -Eiq '(^error:|Error Code:|failed to|DumpLayout failed|Get window nodes failed)' "$command_output"; then
    failure="hdc command output reported failure: $*"
    return 1
  fi
}

capture_targets() {
  local file="$1"
  log "+ $HDC_BIN list targets -v"
  set +e
  "$HDC_BIN" list targets -v 2>&1 | tee "$file" | tee -a "$LOG_FILE"
  local statuses=("${PIPESTATUS[@]}")
  set -e
  local command_status="${statuses[0]}"
  if [[ "$command_status" != "0" ]]; then
    failure="hdc list targets exited $command_status"
    return "$command_status"
  fi
  if grep -Fq "[Fail]" "$file"; then
    failure="hdc list targets reported failure"
    return 1
  fi
}

require_token() {
  local file="$1"
  local token="$2"
  if ! grep -Fq "$token" "$file"; then
    failure="missing token '$token' in $file"
    log "missing token '$token' in $file"
    return 1
  fi
}

reject_token() {
  local file="$1"
  local token="$2"
  if grep -Fq "$token" "$file"; then
    failure="unexpected token '$token' in $file"
    log "unexpected token '$token' in $file"
    return 1
  fi
}

target_ready() {
  local file="$1"
  grep -F "$TARGET" "$file" | grep -Fv "Offline" | grep -Fv "unknown" | grep -Fv "Unknown" >/dev/null
}

require_ready_target() {
  local file="$1"
  if ! grep -Fq "$TARGET" "$file"; then
    failure="missing target '$TARGET' in $file"
    log "$failure"
    return 1
  fi
  if ! target_ready "$file"; then
    failure="target '$TARGET' is not ready in $file"
    log "$failure"
    return 1
  fi
}

require_non_empty_output() {
  local file="$1"
  local label="$2"
  if ! grep -Eq '[^[:space:]]' "$file"; then
    failure="$label produced empty output"
    log "$failure"
    return 1
  fi
}

wait_for_process() {
  local deadline=$((SECONDS + PROCESS_WAIT_SECONDS))
  local attempt=1
  while true; do
    log "pidof poll attempt=$attempt"
    run_hdc "$HDC_BIN" -t "$TARGET" shell pidof "$BUNDLE"
    if grep -Eq '[^[:space:]]' "$LAST_HDC_OUTPUT_FILE"; then
      return 0
    fi
    if (( SECONDS >= deadline )); then
      failure="pidof $BUNDLE produced empty output after ${PROCESS_WAIT_SECONDS}s"
      log "$failure"
      return 1
    fi
    sleep "$PROCESS_POLL_INTERVAL_SECONDS"
    attempt=$((attempt + 1))
  done
}

sha256_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

xml_escape() {
  printf '%s' "$1" |
    sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g; s/'"'"'/\&apos;/g'
}

repo_head() {
  git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || printf 'unknown'
}

repo_dirty() {
  if git -C "$ROOT_DIR" status --porcelain --untracked-files=normal 2>/dev/null | grep -q .; then
    printf 'true'
  else
    printf 'false'
  fi
}

status="PASS"
failure=""
device_executor_used=false
external_network_used=false
runtime_proxy_enabled=false
runtime_proxy_source="none"
runtime_proxy_original_host=""
runtime_proxy_device_host=""
runtime_proxy_device_port="0"
runtime_proxy_host_hash="none"
runtime_proxy_original_host_hash="none"
runtime_proxy_endpoint_rewritten=false
runtime_proxy_listen_scope="not_checked"
runtime_proxy_local_port_reachable=false
runtime_proxy_app_level_applied=false
runtime_proxy_app_level_status="not_observed"
host_network_probe_executed=false
host_direct_https_class="not_run"
host_proxy_https_class="not_configured"
host_proxy_http_class="not_configured"
local_http_probe_configured=false
local_http_server_started=false
local_http_server_reachable=false
local_http_server_pid=""
local_http_device_host_hash="none"
local_http_port="0"
local_feed_probe_configured=false
local_feed_fixture_served=false
device_data_store_probe_configured=true
device_data_store_schema_version=75
device_data_store_migration_step_count=32
device_data_store_record_count=3
device_data_store_runtime_passed=false
device_local_book_probe_configured=true
device_local_book_format="epub"
device_local_book_toc_count=1
device_local_book_bookshelf_count=1
device_local_book_permission_handoff=true
device_local_book_runtime_passed=false
device_reader_ui_probe_configured=true
device_reader_ui_mode="fixture"
device_reader_ui_toc_count=0
device_reader_ui_runtime_passed=false
device_source_management_probe_configured=true
device_source_management_mode="fixture"
device_source_management_source_count=3
device_source_management_enabled_count=2
device_source_management_debug_passed=false
device_source_management_redacted=false
device_source_management_runtime_passed=false
device_headless_service_demo_configured=true
device_headless_service_demo_mode="fixture"
device_headless_service_demo_download_passed=false
device_headless_service_demo_download_completed_count=0
device_headless_service_demo_download_scheduled_count=0
device_headless_service_demo_tts_passed=false
device_headless_service_demo_tts_queued_segments=0
device_headless_service_demo_webdav_passed=false
device_headless_service_demo_file_token_passed=false
device_headless_service_demo_database_migration_passed=false
device_headless_service_demo_schema_version=0
device_headless_service_demo_migration_step_count=0
device_headless_service_demo_redacted=false
device_headless_service_demo_runtime_passed=false

cleanup_local_http_server() {
  if [[ -n "$local_http_server_pid" ]]; then
    kill "$local_http_server_pid" >/dev/null 2>&1 || true
    wait "$local_http_server_pid" >/dev/null 2>&1 || true
    local_http_server_pid=""
  fi
}

trap 'status="FAIL"; [[ -n "$failure" ]] || failure="command failed near line $LINENO"; write_summary; write_junit; update_latest_pointer; cleanup_local_http_server; exit 1' ERR

hash_text() {
  printf '%s' "$1" | shasum -a 256 | awk '{print substr($1, 1, 8)}'
}

proxy_url_host() {
  printf '%s' "$1" | sed -E 's#^[a-zA-Z0-9+.-]+://([^/:]+):([0-9]+).*$#\1#'
}

proxy_url_port() {
  printf '%s' "$1" | sed -E 's#^[a-zA-Z0-9+.-]+://([^/:]+):([0-9]+).*$#\2#'
}

detect_proxy_listen_scope() {
  local port="$1"
  if [[ -z "$port" || ! "$port" =~ ^[0-9]+$ ]]; then
    printf 'invalid-port'
    return 0
  fi
  if ! command -v lsof >/dev/null 2>&1; then
    printf 'lsof-unavailable'
    return 0
  fi

  local listeners
  listeners="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "$listeners" ]]; then
    printf 'none'
    return 0
  fi
  if printf '%s\n' "$listeners" | grep -Eq '(\*|0\.0\.0\.0|\[::\])[:.]'"$port"'([[:space:]]|$)'; then
    printf 'wildcard'
    return 0
  fi
  if printf '%s\n' "$listeners" | grep -Eq '(127\.0\.0\.1|localhost|\[::1\])[:.]'"$port"'([[:space:]]|$)'; then
    printf 'loopback-only'
    return 0
  fi
  printf 'non-loopback-specific'
}

detect_local_port_reachable() {
  local host="$1"
  local port="$2"
  if [[ -z "$host" || -z "$port" || ! "$port" =~ ^[0-9]+$ ]]; then
    return 1
  fi
  if ! command -v nc >/dev/null 2>&1; then
    return 1
  fi
  nc -z -G 2 "$host" "$port" >/dev/null 2>&1
}

pick_local_http_port() {
  python3 - <<'PY'
import socket
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.bind(("127.0.0.1", 0))
    print(sock.getsockname()[1])
PY
}

start_local_http_probe_server() {
  if [[ "$LOCAL_HTTP_MODE" == "off" ]]; then
    local_http_probe_configured=false
    return 0
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    failure="python3 unavailable for device-local HTTP probe"
    return 1
  fi

  local port="$LOCAL_HTTP_PORT"
  if [[ -z "$port" ]]; then
    port="$(pick_local_http_port)"
  fi
  if [[ -z "$port" || ! "$port" =~ ^[0-9]+$ ]]; then
    failure="invalid device-local HTTP probe port"
    return 1
  fi

  local_http_probe_configured=true
  local_feed_probe_configured=true
  local_http_port="$port"
  local_http_device_host_hash="$(hash_text "$LOCAL_HTTP_DEVICE_HOST")"
  mkdir -p "$LOCAL_HTTP_ROOT"
  printf '%s\n' "Reader HarmonyOS Local HTTP OK" > "$LOCAL_HTTP_ROOT/reader-runtime-smoke"
  cat > "$LOCAL_HTTP_ROOT/reader-runtime-feed.xml" <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Reader Runtime Feed</title>
    <link>urn:reader-runtime-feed</link>
    <description>Device-local RSS fixture for HarmonyOS runtime smoke</description>
    <item>
      <guid>urn:reader-runtime-feed:item:1</guid>
      <title>Runtime Feed Item</title>
      <link>urn:reader-runtime-feed:item:1</link>
      <description>Redacted local feed entry</description>
      <category>runtime</category>
    </item>
  </channel>
</rss>
XML
  local_feed_fixture_served=true
  python3 -u -m http.server "$local_http_port" --bind "$LOCAL_HTTP_BIND_HOST" --directory "$LOCAL_HTTP_ROOT" > "$LOCAL_HTTP_LOG" 2>&1 &
  local_http_server_pid="$!"
  local_http_server_started=true
  sleep 1
  if detect_local_port_reachable "$LOCAL_HTTP_BIND_HOST" "$local_http_port"; then
    local_http_server_reachable=true
    log "device-local HTTP probe server started hostHash=$local_http_device_host_hash port=$local_http_port"
    return 0
  fi

  failure="device-local HTTP probe server not reachable"
  return 1
}

detect_runtime_proxy() {
  if [[ "$RUNTIME_PROXY_MODE" == "off" ]]; then
    runtime_proxy_enabled=false
    runtime_proxy_source="off"
    runtime_proxy_listen_scope="off"
    return 0
  fi

  local host="$RUNTIME_PROXY_HOST"
  local port="$RUNTIME_PROXY_PORT"
  local source="explicit"

  if [[ -z "$host" || -z "$port" ]]; then
    local candidate="$RUNTIME_PROXY_URL"
    if [[ -z "$candidate" ]]; then
      candidate="${http_proxy:-${https_proxy:-}}"
      source="env"
    else
      source="env-url"
    fi
    if [[ -n "$candidate" ]]; then
      host="$(proxy_url_host "$candidate")"
      port="$(proxy_url_port "$candidate")"
    fi
  fi

  if [[ -z "$host" || -z "$port" ]]; then
    runtime_proxy_enabled=false
    runtime_proxy_source="none"
    runtime_proxy_listen_scope="none"
    return 0
  fi
  if ! [[ "$port" =~ ^[0-9]+$ ]]; then
    runtime_proxy_enabled=false
    runtime_proxy_source="invalid-port"
    runtime_proxy_listen_scope="invalid-port"
    return 0
  fi

  local original_host="$host"
  runtime_proxy_original_host="$original_host"
  runtime_proxy_original_host_hash="$(hash_text "$original_host")"
  runtime_proxy_listen_scope="$(detect_proxy_listen_scope "$port")"
  if detect_local_port_reachable "$original_host" "$port"; then
    runtime_proxy_local_port_reachable=true
    if [[ "$runtime_proxy_listen_scope" == "none" ]]; then
      runtime_proxy_listen_scope="unlisted-reachable"
    fi
  else
    runtime_proxy_local_port_reachable=false
  fi

  if [[ "$host" == "127.0.0.1" || "$host" == "localhost" ]]; then
    host="10.0.2.2"
    runtime_proxy_endpoint_rewritten=true
  fi

  runtime_proxy_enabled=true
  runtime_proxy_source="$source"
  runtime_proxy_device_host="$host"
  runtime_proxy_device_port="$port"
  runtime_proxy_host_hash="$(hash_text "$host")"
}

update_runtime_network_from_layout() {
  runtime_proxy_app_level_applied=false
  runtime_proxy_app_level_status="not_observed"
  if [[ "$runtime_proxy_enabled" != "true" ]]; then
    runtime_proxy_app_level_status="off"
    return 0
  fi
  if [[ ! -f "$RUNTIME_LAYOUT" ]]; then
    return 0
  fi
  local status_token
  status_token="$(grep -Eo 'app:[A-Za-z0-9_-]+' "$RUNTIME_LAYOUT" | head -n 1 | cut -d: -f2 || true)"
  if [[ "$status_token" == "on" ]]; then
    runtime_proxy_app_level_applied=true
    runtime_proxy_app_level_status="on"
    return 0
  fi
  if [[ -n "$status_token" ]]; then
    runtime_proxy_app_level_status="$status_token"
  fi
}

update_device_data_store_from_layout() {
  device_data_store_runtime_passed=false
  if [[ ! -f "$RUNTIME_LAYOUT" ]]; then
    return 0
  fi
  if grep -Fq "DataStore" "$RUNTIME_LAYOUT" && grep -Fq "PASS v75:3" "$RUNTIME_LAYOUT"; then
    device_data_store_runtime_passed=true
  fi
}

update_device_local_book_from_layout() {
  device_local_book_runtime_passed=false
  if [[ ! -f "$RUNTIME_LAYOUT" ]]; then
    return 0
  fi
  if grep -Fq "LocalBook" "$RUNTIME_LAYOUT" && grep -Fq "PASS epub:1" "$RUNTIME_LAYOUT"; then
    device_local_book_runtime_passed=true
  fi
}

update_device_reader_ui_from_home_layout() {
  device_reader_ui_runtime_passed=false
  if [[ ! -f "$HOME_LAYOUT" ]]; then
    return 0
  fi
  local observed_toc_count
  observed_toc_count="$(grep -Eo 'TOC [0-9]+' "$HOME_LAYOUT" | head -n 1 | awk '{print $2}' || true)"
  if [[ -n "$observed_toc_count" && "$observed_toc_count" =~ ^[0-9]+$ ]]; then
    device_reader_ui_toc_count="$observed_toc_count"
  fi
  if grep -Fq "阅读器" "$HOME_LAYOUT" &&
    grep -Fq "ReaderShell PASS fixture" "$HOME_LAYOUT" &&
    grep -Fq "章节" "$HOME_LAYOUT" &&
    grep -Fq "正文" "$HOME_LAYOUT" &&
    [[ "$device_reader_ui_toc_count" =~ ^[1-9][0-9]*$ ]]; then
    device_reader_ui_runtime_passed=true
  fi
}

update_device_source_management_from_runtime_layout() {
  device_source_management_debug_passed=false
  device_source_management_redacted=false
  device_source_management_runtime_passed=false
  if [[ ! -f "$RUNTIME_LAYOUT" ]]; then
    return 0
  fi
  if grep -Fq "DEBUG fixture" "$RUNTIME_LAYOUT"; then
    device_source_management_debug_passed=true
  fi
  if grep -Fq "redacted:true" "$RUNTIME_LAYOUT"; then
    device_source_management_redacted=true
  fi
  if grep -Fq "书源管理" "$RUNTIME_LAYOUT" &&
    grep -Fq "SourceMgmt PASS fixture" "$RUNTIME_LAYOUT" &&
    grep -Fq "启用 2/3" "$RUNTIME_LAYOUT" &&
    grep -Fq "规则 search+detail+toc+content" "$RUNTIME_LAYOUT" &&
    [[ "$device_source_management_debug_passed" == "true" ]] &&
    [[ "$device_source_management_redacted" == "true" ]]; then
    device_source_management_runtime_passed=true
  fi
}

update_device_headless_service_demo_from_runtime_layout() {
  device_headless_service_demo_download_passed=false
  device_headless_service_demo_tts_passed=false
  device_headless_service_demo_webdav_passed=false
  device_headless_service_demo_file_token_passed=false
  device_headless_service_demo_database_migration_passed=false
  device_headless_service_demo_redacted=false
  device_headless_service_demo_runtime_passed=false
  if [[ ! -f "$RUNTIME_LAYOUT" ]]; then
    return 0
  fi

  local download_counts
  download_counts="$(grep -Eo 'PASS [0-9]+/[0-9]+' "$RUNTIME_LAYOUT" | head -n 1 | awk '{print $2}' || true)"
  if [[ "$download_counts" =~ ^([0-9]+)/([0-9]+)$ ]]; then
    device_headless_service_demo_download_completed_count="${BASH_REMATCH[1]}"
    device_headless_service_demo_download_scheduled_count="${BASH_REMATCH[2]}"
  fi
  local tts_count
  tts_count="$(grep -Eo 'PASS q:[0-9]+' "$RUNTIME_LAYOUT" | head -n 1 | cut -d: -f2 || true)"
  if [[ "$tts_count" =~ ^[0-9]+$ ]]; then
    device_headless_service_demo_tts_queued_segments="$tts_count"
  fi
  local db_migration
  db_migration="$(grep -Eo 'PASS v[0-9]+:[0-9]+' "$RUNTIME_LAYOUT" | awk '{print $2}' | grep -Ev '^v75:3$' | head -n 1 || true)"
  if [[ "$db_migration" =~ ^v([0-9]+):([0-9]+)$ ]]; then
    device_headless_service_demo_schema_version="${BASH_REMATCH[1]}"
    device_headless_service_demo_migration_step_count="${BASH_REMATCH[2]}"
  fi

  if grep -Fq "Download" "$RUNTIME_LAYOUT" && grep -Fq "PASS 2/2" "$RUNTIME_LAYOUT"; then
    device_headless_service_demo_download_passed=true
  fi
  if grep -Fq "TTS" "$RUNTIME_LAYOUT" && grep -Fq "PASS q:3" "$RUNTIME_LAYOUT"; then
    device_headless_service_demo_tts_passed=true
  fi
  if grep -Fq "WebDAV" "$RUNTIME_LAYOUT" && grep -Fq "PASS sync" "$RUNTIME_LAYOUT"; then
    device_headless_service_demo_webdav_passed=true
  fi
  if grep -Fq "FileToken" "$RUNTIME_LAYOUT" && grep -Fq "PASS opaque" "$RUNTIME_LAYOUT"; then
    device_headless_service_demo_file_token_passed=true
  fi
  if grep -Fq "DBMig" "$RUNTIME_LAYOUT" && grep -Fq "PASS v75:32" "$RUNTIME_LAYOUT"; then
    device_headless_service_demo_database_migration_passed=true
  fi
  if grep -Fq "raw:false" "$RUNTIME_LAYOUT"; then
    device_headless_service_demo_redacted=true
  fi
  if grep -Fq "Headless" "$RUNTIME_LAYOUT" &&
    grep -Fq "PASS fixture" "$RUNTIME_LAYOUT" &&
    [[ "$device_headless_service_demo_download_passed" == "true" ]] &&
    [[ "$device_headless_service_demo_tts_passed" == "true" ]] &&
    [[ "$device_headless_service_demo_webdav_passed" == "true" ]] &&
    [[ "$device_headless_service_demo_file_token_passed" == "true" ]] &&
    [[ "$device_headless_service_demo_database_migration_passed" == "true" ]] &&
    [[ "$device_headless_service_demo_redacted" == "true" ]]; then
    device_headless_service_demo_runtime_passed=true
  fi
}

classify_http_code() {
  local code="$1"
  if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
    printf 'http_2xx'
  elif [[ "$code" =~ ^3[0-9][0-9]$ ]]; then
    printf 'http_3xx'
  elif [[ "$code" =~ ^4[0-9][0-9]$ ]]; then
    printf 'http_4xx'
  elif [[ "$code" =~ ^5[0-9][0-9]$ ]]; then
    printf 'http_5xx'
  elif [[ "$code" == "000" || -z "$code" ]]; then
    printf 'no_http_status'
  else
    printf 'http_other'
  fi
}

classify_curl_exit() {
  local exit_code="$1"
  local http_code="$2"
  case "$exit_code" in
    6) printf 'dns_error' ;;
    7) printf 'connect_error' ;;
    28) printf 'timeout' ;;
    35) printf 'tls_error' ;;
    52) printf 'empty_reply' ;;
    56) printf 'receive_error' ;;
    *)
      if [[ -n "$http_code" && "$http_code" != "000" ]]; then
        printf 'curl_%s_%s' "$exit_code" "$(classify_http_code "$http_code")"
      else
        printf 'curl_%s' "$exit_code"
      fi
      ;;
  esac
}

curl_probe_class() {
  local mode="$1"
  local url="$2"
  local proxy_url="${3:-}"
  local http_code
  local exit_code
  set +e
  if [[ "$mode" == "proxy" ]]; then
    http_code="$(curl -sS -I --max-time 8 --proxy "$proxy_url" -o /dev/null -w '%{http_code}' "$url" 2>/dev/null)"
  else
    http_code="$(curl -sS -I --max-time 8 --noproxy '*' -o /dev/null -w '%{http_code}' "$url" 2>/dev/null)"
  fi
  exit_code="$?"
  set -e
  if [[ "$exit_code" == "0" ]]; then
    classify_http_code "$http_code"
  else
    classify_curl_exit "$exit_code" "$http_code"
  fi
}

run_host_network_probe() {
  if ! command -v curl >/dev/null 2>&1; then
    host_network_probe_executed=false
    host_direct_https_class="curl_unavailable"
    host_proxy_https_class="curl_unavailable"
    host_proxy_http_class="curl_unavailable"
    return 0
  fi

  host_network_probe_executed=true
  host_direct_https_class="$(curl_probe_class direct "https://example.com/" "")"

  if [[ "$runtime_proxy_enabled" != "true" || -z "$runtime_proxy_original_host" || "$runtime_proxy_device_port" == "0" ]]; then
    host_proxy_https_class="not_configured"
    host_proxy_http_class="not_configured"
    return 0
  fi

  local proxy_url="http://$runtime_proxy_original_host:$runtime_proxy_device_port"
  host_proxy_https_class="$(curl_probe_class proxy "https://example.com/" "$proxy_url")"
  host_proxy_http_class="$(curl_probe_class proxy "http://example.com/" "$proxy_url")"
}

write_summary() {
  local generated_at
  generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local home_checksum="missing"
  local runtime_checksum="missing"
  local screenshot_checksum="missing"
  [[ -f "$HOME_LAYOUT" ]] && home_checksum="$(sha256_file "$HOME_LAYOUT")"
  [[ -f "$RUNTIME_LAYOUT" ]] && runtime_checksum="$(sha256_file "$RUNTIME_LAYOUT")"
  [[ -f "$SCREENSHOT" ]] && screenshot_checksum="$(sha256_file "$SCREENSHOT")"
  {
    printf '{\n'
    printf '  "schemaVersion": "%s",\n' "$SCHEMA_VERSION"
    printf '  "status": "%s",\n' "$status"
    printf '  "failure": "%s",\n' "$(json_escape "$failure")"
    printf '  "generatedAt": "%s",\n' "$generated_at"
    printf '  "ciGate": {\n'
    printf '    "name": "%s",\n' "$CI_GATE_NAME"
    printf '    "eligible": true,\n'
    printf '    "result": "%s",\n' "$status"
    printf '    "junit": "%s"\n' "$(json_escape "$JUNIT_FILE")"
    printf '  },\n'
    printf '  "repo": {\n'
    printf '    "head": "%s",\n' "$(json_escape "$(repo_head)")"
    printf '    "dirty": %s\n' "$(repo_dirty)"
    printf '  },\n'
    printf '  "target": "%s",\n' "$(json_escape "$TARGET")"
    printf '  "bundle": "%s",\n' "$(json_escape "$BUNDLE")"
    printf '  "module": "%s",\n' "$(json_escape "$MODULE")"
    printf '  "ability": "%s",\n' "$(json_escape "$ABILITY")"
    printf '  "runtimeWaitSeconds": %s,\n' "$RUNTIME_WAIT_SECONDS"
    printf '  "runtimePollIntervalSeconds": %s,\n' "$RUNTIME_POLL_INTERVAL_SECONDS"
    printf '  "processWaitSeconds": %s,\n' "$PROCESS_WAIT_SECONDS"
    printf '  "processPollIntervalSeconds": %s,\n' "$PROCESS_POLL_INTERVAL_SECONDS"
    printf '  "runtimeNetwork": {\n'
    printf '    "proxyMode": "%s",\n' "$(json_escape "$RUNTIME_PROXY_MODE")"
    printf '    "proxyEnabled": %s,\n' "$runtime_proxy_enabled"
    printf '    "proxySource": "%s",\n' "$(json_escape "$runtime_proxy_source")"
    printf '    "proxyHostHash": "%s",\n' "$(json_escape "$runtime_proxy_host_hash")"
    printf '    "proxyOriginalHostHash": "%s",\n' "$(json_escape "$runtime_proxy_original_host_hash")"
    printf '    "proxyPort": %s,\n' "$runtime_proxy_device_port"
    printf '    "proxyEndpointRewrittenForEmulator": %s,\n' "$runtime_proxy_endpoint_rewritten"
    printf '    "proxyListenScope": "%s",\n' "$(json_escape "$runtime_proxy_listen_scope")"
    printf '    "proxyLocalPortReachable": %s,\n' "$runtime_proxy_local_port_reachable"
    printf '    "proxyAppLevelApplied": %s,\n' "$runtime_proxy_app_level_applied"
    printf '    "proxyAppLevelStatus": "%s"\n' "$(json_escape "$runtime_proxy_app_level_status")"
    printf '  },\n'
    printf '  "hostNetworkProbe": {\n'
    printf '    "executed": %s,\n' "$host_network_probe_executed"
    printf '    "directHttpsClass": "%s",\n' "$(json_escape "$host_direct_https_class")"
    printf '    "proxyHttpsClass": "%s",\n' "$(json_escape "$host_proxy_https_class")"
    printf '    "proxyHttpClass": "%s"\n' "$(json_escape "$host_proxy_http_class")"
    printf '  },\n'
    printf '  "deviceLocalHTTPProbe": {\n'
    printf '    "configured": %s,\n' "$local_http_probe_configured"
    printf '    "serverStarted": %s,\n' "$local_http_server_started"
    printf '    "serverReachable": %s,\n' "$local_http_server_reachable"
    printf '    "deviceHostHash": "%s",\n' "$(json_escape "$local_http_device_host_hash")"
    printf '    "port": %s\n' "$local_http_port"
    printf '  },\n'
    printf '  "deviceLocalFeedProbe": {\n'
    printf '    "configured": %s,\n' "$local_feed_probe_configured"
    printf '    "fixtureServed": %s,\n' "$local_feed_fixture_served"
    printf '    "serverReachable": %s,\n' "$local_http_server_reachable"
    printf '    "deviceHostHash": "%s",\n' "$(json_escape "$local_http_device_host_hash")"
    printf '    "port": %s\n' "$local_http_port"
    printf '  },\n'
    printf '  "deviceDataStoreProbe": {\n'
    printf '    "configured": %s,\n' "$device_data_store_probe_configured"
    printf '    "schemaVersion": %s,\n' "$device_data_store_schema_version"
    printf '    "migrationStepCount": %s,\n' "$device_data_store_migration_step_count"
    printf '    "recordCount": %s,\n' "$device_data_store_record_count"
    printf '    "passedInRuntimePanel": %s\n' "$device_data_store_runtime_passed"
    printf '  },\n'
    printf '  "deviceLocalBookProbe": {\n'
    printf '    "configured": %s,\n' "$device_local_book_probe_configured"
    printf '    "format": "%s",\n' "$(json_escape "$device_local_book_format")"
    printf '    "tocCount": %s,\n' "$device_local_book_toc_count"
    printf '    "bookshelfCount": %s,\n' "$device_local_book_bookshelf_count"
    printf '    "permissionHandoff": %s,\n' "$device_local_book_permission_handoff"
    printf '    "passedInRuntimePanel": %s\n' "$device_local_book_runtime_passed"
    printf '  },\n'
    printf '  "deviceReaderUISmoke": {\n'
    printf '    "configured": %s,\n' "$device_reader_ui_probe_configured"
    printf '    "mode": "%s",\n' "$(json_escape "$device_reader_ui_mode")"
    printf '    "tocCount": %s,\n' "$device_reader_ui_toc_count"
    printf '    "passedInHomeLayout": %s\n' "$device_reader_ui_runtime_passed"
    printf '  },\n'
    printf '  "deviceSourceManagementSmoke": {\n'
    printf '    "configured": %s,\n' "$device_source_management_probe_configured"
    printf '    "mode": "%s",\n' "$(json_escape "$device_source_management_mode")"
    printf '    "sourceCount": %s,\n' "$device_source_management_source_count"
    printf '    "enabledCount": %s,\n' "$device_source_management_enabled_count"
    printf '    "debugPassed": %s,\n' "$device_source_management_debug_passed"
    printf '    "redacted": %s,\n' "$device_source_management_redacted"
    printf '    "passedInSettingsLayout": %s\n' "$device_source_management_runtime_passed"
    printf '  },\n'
    printf '  "deviceHeadlessServiceDemo": {\n'
    printf '    "configured": %s,\n' "$device_headless_service_demo_configured"
    printf '    "mode": "%s",\n' "$(json_escape "$device_headless_service_demo_mode")"
    printf '    "downloadPassed": %s,\n' "$device_headless_service_demo_download_passed"
    printf '    "downloadCompletedCount": %s,\n' "$device_headless_service_demo_download_completed_count"
    printf '    "downloadScheduledCount": %s,\n' "$device_headless_service_demo_download_scheduled_count"
    printf '    "ttsPassed": %s,\n' "$device_headless_service_demo_tts_passed"
    printf '    "ttsQueuedSegments": %s,\n' "$device_headless_service_demo_tts_queued_segments"
    printf '    "webdavPassed": %s,\n' "$device_headless_service_demo_webdav_passed"
    printf '    "fileTokenPassed": %s,\n' "$device_headless_service_demo_file_token_passed"
    printf '    "databaseMigrationPassed": %s,\n' "$device_headless_service_demo_database_migration_passed"
    printf '    "schemaVersion": %s,\n' "$device_headless_service_demo_schema_version"
    printf '    "migrationStepCount": %s,\n' "$device_headless_service_demo_migration_step_count"
    printf '    "redacted": %s,\n' "$device_headless_service_demo_redacted"
    printf '    "passedInRuntimePanel": %s\n' "$device_headless_service_demo_runtime_passed"
    printf '  },\n'
    printf '  "deviceExecutorUsed": %s,\n' "$device_executor_used"
    printf '  "externalNetworkUsed": %s,\n' "$external_network_used"
    printf '  "rawURLExported": false,\n'
    printf '  "rawCookieValueExported": false,\n'
    printf '  "rawCredentialValueExported": false,\n'
    printf '  "rawSessionTokenExported": false,\n'
    printf '  "rawResponseBodyExported": false,\n'
    printf '  "readerCoreRootArtifactsMutated": false,\n'
    printf '  "requiredRuntimeTokens": ["nativeHTTP", "LocalHTTP", "LocalFeed", "DataStore", "LocalBook", "SourceMgmt PASS fixture", "启用 2/3", "规则 search+detail+toc+content", "DEBUG fixture", "redacted:true", "Headless", "PASS fixture", "Download", "PASS 2/2", "TTS", "PASS q:3", "WebDAV", "PASS sync", "FileToken", "PASS opaque", "DBMig", "PASS v75:32", "PASS 2xx", "PASS rss:1", "PASS v75:3", "PASS epub:1", "ArkWeb", "Cookie", "Session", "JS", "Secure", "Corpus", "raw:false"],\n'
    printf '  "artifacts": {\n'
    printf '    "homeLayout": "%s",\n' "$(json_escape "$HOME_LAYOUT")"
    printf '    "runtimeLayout": "%s",\n' "$(json_escape "$RUNTIME_LAYOUT")"
    printf '    "runtimeScreenshot": "%s",\n' "$(json_escape "$SCREENSHOT")"
    printf '    "log": "%s",\n' "$(json_escape "$LOG_FILE")"
    printf '    "junit": "%s"\n' "$(json_escape "$JUNIT_FILE")"
    printf '  },\n'
    printf '  "checksums": {\n'
    printf '    "homeLayoutSha256": "%s",\n' "$home_checksum"
    printf '    "runtimeLayoutSha256": "%s",\n' "$runtime_checksum"
    printf '    "runtimeScreenshotSha256": "%s"\n' "$screenshot_checksum"
    printf '  }\n'
    printf '}\n'
  } > "$SUMMARY_FILE"
}

write_junit() {
  local failures="0"
  local escaped_failure
  escaped_failure="$(xml_escape "$failure")"
  if [[ "$status" != "PASS" ]]; then
    failures="1"
  fi
  {
    printf '<?xml version="1.0" encoding="UTF-8"?>\n'
    printf '<testsuite name="%s" tests="1" failures="%s">\n' "$(xml_escape "$CI_GATE_NAME")" "$failures"
    printf '  <testcase classname="HarmonyOSDeviceRuntimeSmoke" name="native_http_arkweb_cookie_session_secure_corpus"'
    if [[ "$status" == "PASS" ]]; then
      printf ' />\n'
    else
      printf '>\n'
      printf '    <failure message="%s">%s</failure>\n' "$escaped_failure" "$escaped_failure"
      printf '  </testcase>\n'
    fi
    printf '</testsuite>\n'
  } > "$JUNIT_FILE"
}

update_latest_pointer() {
  if [[ "$OUT_DIR" != "$LATEST_DIR" ]]; then
    mkdir -p "$(dirname "$LATEST_DIR")"
    ln -sfn "$OUT_DIR" "$LATEST_DIR"
  fi
}

capture_runtime_layout() {
  run_hdc "$HDC_BIN" -t "$TARGET" shell uitest dumpLayout -p "$REMOTE_RUNTIME" -b "$BUNDLE"
  run_hdc "$HDC_BIN" -t "$TARGET" file recv "$REMOTE_RUNTIME" "$RUNTIME_LAYOUT"
}

runtime_panel_settled() {
  local file="$1"
  grep -Fq "运行证据" "$file" &&
    grep -Fq "nativeHTTP" "$file" &&
    grep -Fq "LocalFeed" "$file" &&
    grep -Fq "DataStore" "$file" &&
    grep -Fq "LocalBook" "$file" &&
    grep -Fq "Headless" "$file" &&
    grep -Fq "Corpus" "$file" &&
    ! grep -Fq "RUNNING" "$file"
}

wait_for_runtime_panel() {
  local deadline=$((SECONDS + RUNTIME_WAIT_SECONDS))
  local attempt=1
  while true; do
    log "runtime poll attempt=$attempt"
    capture_runtime_layout
    if runtime_panel_settled "$RUNTIME_LAYOUT"; then
      log "runtime panel settled"
      return 0
    fi
    if (( SECONDS >= deadline )); then
      log "runtime panel did not settle within ${RUNTIME_WAIT_SECONDS}s"
      return 0
    fi
    sleep "$RUNTIME_POLL_INTERVAL_SECONDS"
    attempt=$((attempt + 1))
  done
}

capture_home_layout() {
  run_hdc "$HDC_BIN" -t "$TARGET" shell uitest dumpLayout -p "$REMOTE_HOME" -b "$BUNDLE"
  run_hdc "$HDC_BIN" -t "$TARGET" file recv "$REMOTE_HOME" "$HOME_LAYOUT"
}

home_panel_settled() {
  local file="$1"
  grep -Fq "书架" "$file" &&
    grep -Fq "藏书" "$file" &&
    grep -Fq "在读" "$file" &&
    grep -Fq "未读" "$file"
}

wait_for_home_panel() {
  local deadline=$((SECONDS + PROCESS_WAIT_SECONDS))
  local attempt=1
  while true; do
    log "home poll attempt=$attempt"
    capture_home_layout
    if home_panel_settled "$HOME_LAYOUT"; then
      log "home panel settled"
      return 0
    fi
    if (( SECONDS >= deadline )); then
      log "home panel did not settle within ${PROCESS_WAIT_SECONDS}s"
      return 0
    fi
    sleep "$PROCESS_POLL_INTERVAL_SECONDS"
    attempt=$((attempt + 1))
  done
}

log "HarmonyOS device runtime smoke started at $STAMP"
log "target=$TARGET bundle=$BUNDLE out=$OUT_DIR"
detect_runtime_proxy
log "runtime proxy mode=$RUNTIME_PROXY_MODE enabled=$runtime_proxy_enabled source=$runtime_proxy_source hostHash=$runtime_proxy_host_hash port=$runtime_proxy_device_port rewritten=$runtime_proxy_endpoint_rewritten listenScope=$runtime_proxy_listen_scope localPortReachable=$runtime_proxy_local_port_reachable"
run_host_network_probe
log "host network probe executed=$host_network_probe_executed directHttps=$host_direct_https_class proxyHttps=$host_proxy_https_class proxyHttp=$host_proxy_http_class"

command -v "$HDC_BIN" >/dev/null
run "$ROOT_DIR/hvigorw" assembleHap

capture_targets "$OUT_DIR/hdc_targets.before.txt"
if ! target_ready "$OUT_DIR/hdc_targets.before.txt"; then
  run_hdc "$HDC_BIN" tconn "$TARGET"
fi
capture_targets "$OUT_DIR/hdc_targets.after.txt"
require_ready_target "$OUT_DIR/hdc_targets.after.txt"

run_hdc "$HDC_BIN" -t "$TARGET" install -r "$HAP_PATH"
start_local_http_probe_server
start_args=(aa start -a "$ABILITY" -b "$BUNDLE" -m "$MODULE")
if [[ "$runtime_proxy_enabled" == "true" ]]; then
  start_args+=(--ps readerRuntimeProxy "$runtime_proxy_device_host:$runtime_proxy_device_port:$runtime_proxy_source")
fi
if [[ "$local_http_probe_configured" == "true" ]]; then
  start_args+=(--ps readerRuntimeLocalHTTP "$LOCAL_HTTP_DEVICE_HOST:$local_http_port:ci-local")
fi
run_hdc "$HDC_BIN" -t "$TARGET" shell "${start_args[@]}"
wait_for_process
device_executor_used=true

wait_for_home_panel
update_device_reader_ui_from_home_layout
require_token "$HOME_LAYOUT" "书架"
require_token "$HOME_LAYOUT" "藏书"
require_token "$HOME_LAYOUT" "在读"
require_token "$HOME_LAYOUT" "未读"
require_token "$HOME_LAYOUT" "阅读器"
require_token "$HOME_LAYOUT" "ReaderShell PASS fixture"
require_token "$HOME_LAYOUT" "章节"
require_token "$HOME_LAYOUT" "正文"
require_token "$HOME_LAYOUT" "TOC"

run_hdc "$HDC_BIN" -t "$TARGET" shell uitest uiInput click "$CLICK_X" "$CLICK_Y"
external_network_used=true
wait_for_runtime_panel
update_runtime_network_from_layout
update_device_data_store_from_layout
update_device_local_book_from_layout
update_device_source_management_from_runtime_layout
update_device_headless_service_demo_from_runtime_layout
run_hdc "$HDC_BIN" -t "$TARGET" shell snapshot_display -f "$REMOTE_SCREENSHOT"
run_hdc "$HDC_BIN" -t "$TARGET" file recv "$REMOTE_SCREENSHOT" "$SCREENSHOT"

require_token "$RUNTIME_LAYOUT" "nativeHTTP"
require_token "$RUNTIME_LAYOUT" "LocalHTTP"
require_token "$RUNTIME_LAYOUT" "LocalFeed"
require_token "$RUNTIME_LAYOUT" "DataStore"
require_token "$RUNTIME_LAYOUT" "LocalBook"
require_token "$RUNTIME_LAYOUT" "PASS 2xx"
require_token "$RUNTIME_LAYOUT" "PASS rss:1"
require_token "$RUNTIME_LAYOUT" "PASS v75:3"
require_token "$RUNTIME_LAYOUT" "PASS epub:1"
require_token "$RUNTIME_LAYOUT" "SourceMgmt PASS fixture"
require_token "$RUNTIME_LAYOUT" "启用 2/3"
require_token "$RUNTIME_LAYOUT" "规则 search+detail+toc+content"
require_token "$RUNTIME_LAYOUT" "DEBUG fixture"
require_token "$RUNTIME_LAYOUT" "redacted:true"
require_token "$RUNTIME_LAYOUT" "Headless"
require_token "$RUNTIME_LAYOUT" "PASS fixture"
require_token "$RUNTIME_LAYOUT" "Download"
require_token "$RUNTIME_LAYOUT" "PASS 2/2"
require_token "$RUNTIME_LAYOUT" "TTS"
require_token "$RUNTIME_LAYOUT" "PASS q:3"
require_token "$RUNTIME_LAYOUT" "WebDAV"
require_token "$RUNTIME_LAYOUT" "PASS sync"
require_token "$RUNTIME_LAYOUT" "FileToken"
require_token "$RUNTIME_LAYOUT" "PASS opaque"
require_token "$RUNTIME_LAYOUT" "DBMig"
require_token "$RUNTIME_LAYOUT" "PASS v75:32"
require_token "$RUNTIME_LAYOUT" "ArkWeb"
require_token "$RUNTIME_LAYOUT" "Cookie"
require_token "$RUNTIME_LAYOUT" "Session"
require_token "$RUNTIME_LAYOUT" "JS"
require_token "$RUNTIME_LAYOUT" "Secure"
require_token "$RUNTIME_LAYOUT" "Corpus"
require_token "$RUNTIME_LAYOUT" "raw:false"
reject_token "$RUNTIME_LAYOUT" "FAIL"
reject_token "$RUNTIME_LAYOUT" "RUNNING"

write_summary
write_junit
update_latest_pointer
cleanup_local_http_server
log "HarmonyOS device runtime smoke PASS"
log "summary=$SUMMARY_FILE"
