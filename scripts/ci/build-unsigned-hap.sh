#!/usr/bin/env bash
set -euo pipefail

if (( $# != 1 )); then
  printf 'Select --prepare, --package-offline, or --native-only\n' >&2
  exit 2
fi
case "$1" in
  --prepare|--package-offline|--native-only) readonly phase=${1#--} ;;
  *) exit 2 ;;
esac

readonly workspace=/reader-ci/workspace
readonly host="$workspace/Reader-for-HarmonyOS"
readonly core="$workspace/Reader-Core"
readonly output=/reader-ci
readonly cli=/opt/command-line-tools
readonly abi=arm64-v8a
readonly rust_target=aarch64-unknown-linux-ohos
readonly lock="$host/scripts/core-dependency.json"

readonly private="$output/private"
[[ -d "$output" && ! -L "$output" ]]
if [[ "$phase" == package-offline ]]; then
  [[ -d "$private" && ! -L "$private" ]]
else
  mkdir -m 0700 "$private"
fi
readonly summary="$private/build-summary.txt"
umask 022

export HOME="$private/home"
export TMPDIR="$private/tmp"
export READER_LOCK_DIR="$private/locks"
export CARGO_HOME="$private/cargo"
export RUSTUP_HOME="$private/rustup"
export CARGO_TARGET_DIR="$private/target"
export CARGO_INCREMENTAL=0 CARGO_PROFILE_RELEASE_DEBUG=0
export READER_HARMONY_ABI="$abi"
export READER_HARMONY_SDK_HOME="$cli/sdk"
export DEVECO_SDK_HOME="$READER_HARMONY_SDK_HOME"
export HOS_SDK_HOME="$READER_HARMONY_SDK_HOME"
export OHOS_NATIVE_HOME="$READER_HARMONY_SDK_HOME/default/openharmony/native"
export LIBCLANG_PATH="$OHOS_NATIVE_HOME/llvm/lib"
export NODE_HOME=/reader-ci/node READER_NODE=/reader-ci/node/bin/node
export PATH="$NODE_HOME/bin:$CARGO_HOME/bin:$cli/bin:$PATH"
if [[ "$phase" != native-only ]]; then
  export HVIGORW="$cli/bin/hvigorw" OHPM="$cli/bin/ohpm"
  export READER_HVIGOR_PLUGIN_PACKAGE="$cli/hvigor/hvigor-ohos-plugin/package.json"
  export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
  export HVIGOR_SHARED_TOOLS="$HOME/.hvigor/wrapper/tools"
  export npm_config_cache="$private/npm-cache"
fi
unset READER_HARMONY_SIGNING_PROFILE

run_stage() {
  local name=$1 started=$SECONDS result
  local log="$private/$name.log"
  shift
  # Keep errexit active inside the stage while capturing its real exit status.
  set +e
  (set -euo pipefail; "$@") > "$log" 2>&1
  result=$?
  set -e
  if (( result != 0 )); then
    printf '%s FAIL (%ss, exit %s)\n' "$name" "$((SECONDS - started))" "$result"
    case "$name" in
      workspace-admission|toolchain-setup|offline-admission|unsigned-hap-build|public-evidence)
        tail -n 120 -- "$log" >&2 || true
        ;;
    esac
    exit "$result"
  fi
  printf '%s PASS (%ss)\n' "$name" "$((SECONDS - started))" | tee -a "$summary"
}

require_clean_checkout() {
  local status
  status=$(git -C "$1" status --porcelain)
  test -z "$status"
}

admit_workspace() {
  [[ ! -e "$output/public" && ! -L "$output/public" ]] || return 1
  test "$(uname -s):$(uname -m)" = Linux:x86_64
  test "$("$READER_NODE" --version)" = v22.23.3
  [[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ && "$(git -C "$host" rev-parse HEAD)" == "$GITHUB_SHA" ]]
  require_clean_checkout "$host"
  require_clean_checkout "$core"

  cd "$workspace"
  "$READER_NODE" --input-type=module - "$lock" "$SDK" <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { coreBuildSnapshot } from './Reader-Core/scripts/build-input-snapshot.mjs';
import { harmonySdkContainerRoot } from './Reader-Core/scripts/lib/development-environment.mjs';

const [lockPath, sdkChoice] = process.argv.slice(2);
const dependency = JSON.parse(readFileSync(lockPath, 'utf8'));
assert.match(dependency.coreCommit, /^[a-f0-9]{40}$/);
assert.match(dependency.coreInputFingerprint, /^[a-f0-9]{64}$/);
assert.deepEqual(dependency.abis, ['arm64-v8a']);
assert.equal(dependency.rustTarget, 'aarch64-unknown-linux-ohos');
assert.equal(dependency.canonicalBuild, 'scripts/build-harmony-napi.sh');
assert.equal(dependency.ciUnsignedOnly, true);
const toolchain = readFileSync('./Reader-Core/rust-toolchain.toml', 'utf8').match(/^channel\s*=\s*"(\d+\.\d+\.\d+)"\s*$/m);
assert.ok(toolchain, 'Core Rust toolchain pin is missing');
assert.equal(dependency.rustToolchain, toolchain[1]);

const snapshot = coreBuildSnapshot(resolve('Reader-Core'));
assert.deepEqual(snapshot.gitIdentity, { gitCommit: dependency.coreCommit, gitDirty: false });
assert.equal(snapshot.fingerprint, dependency.coreInputFingerprint);
const trackedContract = JSON.parse(readFileSync('./Reader-for-HarmonyOS/entry/vendor/core-harmony/storage-contract.v1.json', 'utf8'));
assert.equal(trackedContract.coreInputFingerprint, dependency.coreInputFingerprint);

const sdk = harmonySdkContainerRoot(process.env.READER_HARMONY_SDK_HOME);
assert.ok(sdk, 'Official Harmony SDK container is missing');
const sdkPackage = JSON.parse(readFileSync(resolve(sdk.packageRoot, 'sdk-pkg.json'), 'utf8')).data;
const api = String(sdkPackage.apiVersion);
assert.equal(api, { api23: '23', api24: '24', api26r: '26' }[sdkChoice]);
if (sdkChoice === 'api26r') {
  assert.equal(sdkPackage.releaseType, 'Release', 'Full HAP compilation requires a release SDK');
}
console.log(`Host ${process.env.GITHUB_SHA}, Core ${dependency.coreCommit}, SDK API ${api} (${sdkPackage.releaseType})`);
NODE
}

prepare_workspace() {
  mkdir -p "$HOME" "$TMPDIR" "$READER_LOCK_DIR"
  git config --global --add safe.directory "$host"
  git config --global --add safe.directory "$core"
  admit_workspace
  cd "$workspace"
  "$READER_NODE" Reader-Core/scripts/sync-workspace.mjs --write
  "$READER_NODE" Reader-Core/scripts/sync-workspace.mjs --check
  require_clean_checkout "$host"
  require_clean_checkout "$core"
}

check_hap_tools() {
  local executable
  for executable in "$HVIGORW" "$OHPM" "$JAVA_HOME/bin/java" \
    "$OHOS_NATIVE_HOME/llvm/bin/llvm-objcopy"; do
    test -x "$executable"
  done
  test -r "$READER_HARMONY_SDK_HOME/default/openharmony/toolchains/lib/hap-sign-tool.jar"
  command -v unzip
  for executable in cmake ninja; do
    test -x "$OHOS_NATIVE_HOME/build-tools/cmake/bin/$executable" || command -v "$executable"
  done
  test -f "$READER_HVIGOR_PLUGIN_PACKAGE"
  test -f "$(dirname "$READER_HVIGOR_PLUGIN_PACKAGE")/../hvigor/package.json"
}

prepare_hap_tools() {
  check_hap_tools
  printf '%s\n' '@ohos:registry=https://repo.harmonyos.com/npm/' > "$HOME/.npmrc"
  cd "$host"
  "$READER_NODE" tools/reader-build-tools.mjs --install
}

prepare_tools() {
  local executable
  test -x "$OHOS_NATIVE_HOME/llvm/bin/clang"
  test -x "$OHOS_NATIVE_HOME/llvm/bin/$rust_target-clang"
  test -r "$LIBCLANG_PATH/libclang.so"
  for executable in cc pkg-config; do
    if ! command -v "$executable"; then
      apt-get -q update
      DEBIAN_FRONTEND=noninteractive apt-get -yq install --no-install-recommends build-essential pkg-config
      break
    fi
  done
  for executable in cmake ninja; do
    if [[ ! -x "$OHOS_NATIVE_HOME/build-tools/cmake/bin/$executable" ]] && ! command -v "$executable"; then
      apt-get -q update
      DEBIAN_FRONTEND=noninteractive apt-get -yq install --no-install-recommends cmake ninja-build
      break
    fi
  done

  local rustup_init="$private/rustup-init"
  curl --fail --silent --show-error --location --retry 3 --output "$rustup_init" \
    'https://static.rust-lang.org/rustup/archive/1.28.2/x86_64-unknown-linux-gnu/rustup-init'
  printf '%s  %s\n' '20a06e644b0d9bd2fbdbfd52d42540bdde820ea7df86e92e533c073da0cdd43c' "$rustup_init" | sha256sum --check
  chmod 700 "$rustup_init"
  "$rustup_init" -y --no-modify-path --default-toolchain none
  rustup toolchain install "$RUSTUP_TOOLCHAIN" --profile minimal --target "$rust_target"
  if [[ "$phase" != native-only ]]; then
    prepare_hap_tools
  fi
}

build_native() {
  cd "$core"
  timeout --kill-after=30s 45m bash scripts/build-harmony-napi.sh --abi "$abi"
}

build_hap() {
  timeout --kill-after=30s 20m bash -euo pipefail -s -- "$host" "$private" "$lock" "$abi" <<'HAP'
cd "$1"
"$READER_NODE" scripts/hap-pipeline.mjs sync-native --abi "$4"
"$READER_NODE" --input-type=module - "$3" <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dependency = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const bootstrap = JSON.parse(readFileSync('entry/src/main/resources/rawfile/reader-core-storage-identity.v1.json', 'utf8'));
assert.equal(bootstrap.coreInputFingerprint, dependency.coreInputFingerprint);
NODE
"$READER_NODE" scripts/hap-pipeline.mjs build --class iteration --signing unsigned \
  --contracts-scope none --abi "$4" --artifact-root "$2/hap"
shopt -s nullglob
manifests=("$2/hap"/*/manifest.json)
test "${#manifests[@]}" -eq 1
manifest=${manifests[0]}
"$READER_NODE" scripts/hap-pipeline.mjs verify --manifest "$manifest"
"$READER_NODE" --input-type=module - "$manifest" "$3" <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const [manifestPath, dependencyPath] = process.argv.slice(2);
const run = JSON.parse(readFileSync(manifestPath, 'utf8'));
const dependency = JSON.parse(readFileSync(dependencyPath, 'utf8'));
assert.equal(run.buildClass, 'iteration');
assert.equal(run.acceptanceEligible, false);
assert.equal(run.source.harmony.commit, process.env.GITHUB_SHA);
assert.equal(run.source.core.commit, dependency.coreCommit);
assert.equal(run.source.core.dirty, false);
assert.equal(run.source.effectiveBuildProfile.mode, 'unsigned');
assert.equal(run.source.effectiveBuildProfile.secretMaterialArchived, false);
assert.equal(run.artifacts.length, 1);
assert.equal(run.artifacts[0].path, 'entry-default-unsigned.hap');
assert.equal(run.artifacts[0].kind, 'unsigned');
assert.equal(run.artifacts[0].signature.status, 'unsigned');
NODE
printf '%s\n' "${manifest%/*}" > "$2/verified-run"
HAP
}

stage_public_evidence() {
  local run staging file forbidden
  local -a files
  read -r run < "$private/verified-run"
  staging=$(mktemp -d "$private/evidence.XXXXXX")
  for file in manifest.json source-snapshot.json; do
    [[ -f "$run/$file" && ! -L "$run/$file" ]] || return 1
    install -m 0644 "$run/$file" "$staging/$file"
  done
  {
    printf 'Unsigned HarmonyOS build (%s, %s, network none)\n' "$abi" "$SDK"
    cat "$private/prepared-inputs"
    cat "$summary"
  } > "$staging/build-summary.txt"
  chmod 0644 "$staging/build-summary.txt"
  forbidden=$(find "$staging" -mindepth 1 \( -iname '*.hap' -o -iname '*.so' \) -print -quit)
  shopt -s dotglob nullglob
  files=("$staging"/*)
  test -z "$forbidden"
  test "${#files[@]}" -eq 3
  [[ ! -e "$output/public" && ! -L "$output/public" ]] || return 1
  chmod 0755 "$staging"
  mv -T "$staging" "$output/public"
}

# sync-native verifies the Native package against the canonical Core inputs.
# Additionally bind both containers to the exact same checkout, image and Native receipt.
prepared_inputs() {
  local evidence="$CARGO_TARGET_DIR/harmony-napi/$abi/harmony-napi-build-evidence.txt"
  printf 'host=%s\ncore=%s\nimage=%s\nsdk=%s\n' "$GITHUB_SHA" "$(git -C "$core" rev-parse HEAD)" "$IMAGE" "$SDK"
  sha256sum "$lock" "$evidence"
}

admit_offline_inputs() {
  local -a interfaces=(/sys/class/net/*)
  [[ "${interfaces[*]}" == /sys/class/net/lo ]]
  admit_workspace
  "$READER_NODE" "$core/scripts/sync-workspace.mjs" --check
  check_hap_tools
  "$READER_NODE" "$host/tools/reader-build-tools.mjs" --profile release
  prepared_inputs > "$private/offline-inputs"
  cmp "$private/prepared-inputs" "$private/offline-inputs"
}

RUSTUP_TOOLCHAIN=$("$READER_NODE" -p 'require(process.argv[1]).rustToolchain' "$lock")
export RUSTUP_TOOLCHAIN
if [[ "$phase" == package-offline ]]; then
  run_stage offline-admission admit_offline_inputs
  run_stage unsigned-hap-build build_hap
  run_stage public-evidence stage_public_evidence
else
  run_stage workspace-admission prepare_workspace
  run_stage toolchain-setup prepare_tools
  run_stage core-native-napi build_native
  if [[ "$phase" == prepare ]]; then
    prepared_inputs > "$private/prepared-inputs"
  fi
fi
