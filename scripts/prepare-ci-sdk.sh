#!/usr/bin/env bash
set -euo pipefail
# Obtain the licensed download URL out of band. Never write it to logs or Git.
: "${HARMONY_TOOLS_URL:?Set the HARMONY_TOOLS_URL repository secret}"
: "${HARMONY_TOOLS_SHA256:?Set the verified HARMONY_TOOLS_SHA256 repository variable}"
: "${RUNNER_TEMP:?Run on an isolated CI runner}"
: "${GITHUB_ENV:?Missing GitHub environment file}"
[[ "$HARMONY_TOOLS_URL" == https://* ]] || { echo 'SDK URL must use HTTPS' >&2; exit 1; }
[[ "$HARMONY_TOOLS_SHA256" =~ ^[0-9a-f]{64}$ ]] || { echo 'Invalid SDK SHA256' >&2; exit 1; }
sdk_dir="$(mktemp -d "$RUNNER_TEMP/reader-sdk.XXXXXX")"
curl --noproxy '*' --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
  --retry 2 --connect-timeout 30 --max-time 1200 "$HARMONY_TOOLS_URL" -o "$sdk_dir/sdk.zip"
printf '%s  %s\n' "$HARMONY_TOOLS_SHA256" "$sdk_dir/sdk.zip" | sha256sum --check --status
unzip -q "$sdk_dir/sdk.zip" -d "$sdk_dir"
sdk_home="$sdk_dir/command-line-tools/sdk/default/openharmony"
test -f "$sdk_home/ets/build-tools/ets-loader/package.json"
{
  echo "READER_ETS_LOADER_ROOT=$sdk_home/ets/build-tools/ets-loader"
  echo "READER_HVIGOR_PLUGIN_PACKAGE=$sdk_dir/command-line-tools/hvigor/hvigor-ohos-plugin/package.json"
  echo "READER_ARKUI_PREVIEW_RUNTIME=$sdk_home/previewer/common/bin/libace_compatible.so"
} >> "$GITHUB_ENV"
