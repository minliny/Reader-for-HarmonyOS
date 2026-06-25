# HarmonyOS 真机 evidence preflight/runbook

Date: 2026-06-25
Branch: `codex/harmony-real-device-evidence`
Scope: 只覆盖 HarmonyOS host repo 的 real-device evidence 前置检查与运行路径；不把 headless 或模拟器 (simulator) 结果提升为真机 (real device) 证据。

## 证据分层

| Tier | 可接受证据 | 当前状态 |
|------|------------|----------|
| headless | `assembleHap`、纯 fixture/parser validator、artifact shape/hash | 已有证据；不代表设备运行 |
| 模拟器 (simulator) | `hdc` target 为 `127.0.0.1:*` / `localhost:*` 的 HAP/runtime smoke | 已有 `HostBus` simulator PASS；不代表真机 |
| 真机 (real device) | `hdc` target 为物理设备 serial/USB id/非 loopback TCP，签名 HAP 安装后运行 `scripts/run_device_runtime_smoke.sh`，summary 写入 `tier: "device"` | no evidence yet |

## Preflight 命令

```bash
bash scripts/preflight_real_device_runtime_smoke.sh
```

可选参数：

```bash
HARMONYOS_REAL_DEVICE_TARGET=<physical-hdc-target> \
HARMONYOS_REAL_DEVICE_HAP_PATH=<signed-hap-path> \
bash scripts/preflight_real_device_runtime_smoke.sh
```

输出位置：

```text
artifacts/real-device-preflight/<UTC_TIMESTAMP>/real_device_preflight_summary.json
artifacts/real-device-preflight/latest/real_device_preflight_summary.json
```

`status` 只有两类：

- `READY`: 真机 target、签名/HAP 前提、NAPI/HostBus 入口均满足，可以进入 runtime smoke。
- `BLOCKED`: 任一前提缺失。脚本以 nonzero 退出，`blockers[]` 给出明确原因。

## Preflight 检查项

脚本会检查：

- `hdc` 是否可用，`hdc list targets` 是否有 target。
- target 是否为真机候选：`127.0.0.1:*` / `localhost:*` 必须归类为模拟器 (simulator)，不得作为 real-device。
- `build-profile.json5` 是否配置 `signingConfigs`，HAP 文件名是否仍是 `unsigned`。
- HAP 是否存在、是否可被 `unzip` 读取、是否包含 `libreader_core_napi.so`。
- `libreader_core_napi.so` 是否包含关键 NAPI/HostBus token：`abiVersion`、`createRuntime`、`releaseRuntime`、`sendCommand`、`cancelRequest`、`readEvent`、`pendingEventCount`、`completeHostRequest`、`failHostRequest`、`pingSmoke`、`hostSmoke`、`lifecycleSmoke`、`sendJsonCommand`、`runtime.hostSmoke`、`host.complete`、`host.error`。
- ArkTS host bus smoke 入口是否仍接在 `ReaderCoreNapiBridge.ets` 与 `RuntimeDeviceEvidencePanel`：`runHostSmokeClosedLoop` + `HostBus` pill。

## 当前机器结果

本机本轮实际结果：

```text
hdc list targets
[Empty]
```

因此当前 real-device tier 仍是 `no evidence yet`。这不是失败的真机 smoke；这是设备前提缺失导致的 `BLOCKED`。

同时当前默认 artifact 是：

```text
entry/build/default/outputs/default/entry-default-unsigned.hap
```

`build-profile.json5` 的 `signingConfigs` 为空；即使接入真机，也必须先提供可安装的签名 HAP，不能把 unsigned HAP 当成真机 evidence。

## 真机接入后的运行顺序

1. 连接物理设备并确认 target 不是 loopback：

```bash
hdc list targets
```

2. 提供签名 HAP，或先配置 `build-profile.json5` 的 `signingConfigs` 后重新打包：

```bash
JAVA_HOME="/Applications/DevEco-Studio.app/Contents/jbr/Contents/Home" \
DEVECO_SDK_HOME="/Applications/DevEco-Studio.app/Contents" \
./hvigorw assembleHap --no-daemon
```

3. 跑 real-device preflight：

```bash
HARMONYOS_REAL_DEVICE_TARGET=<physical-hdc-target> \
HARMONYOS_REAL_DEVICE_HAP_PATH=<signed-hap-path> \
bash scripts/preflight_real_device_runtime_smoke.sh
```

4. 只有 preflight `READY` 后，才跑 HAP/device smoke：

```bash
HARMONYOS_DEVICE_TARGET=<physical-hdc-target> \
HARMONYOS_HAP_PATH=<signed-hap-path> \
bash scripts/run_device_runtime_smoke.sh
```

5. 验证 device smoke artifact：

```bash
python3 scripts/validate_device_runtime_smoke_artifact.py \
  artifacts/device-runtime-smoke/latest/device_runtime_smoke_summary.json
```

验收条件：

- `device_runtime_smoke_summary.json` 的 `tier` 必须是 `"device"`。
- `target` 必须是物理设备 target，不能是 `127.0.0.1:*` / `localhost:*`。
- `requiredRuntimeTokens` 必须包含 `HostBus` 和 `PASS op:`。
- `status` 必须是 `PASS`，并且 `ciGate.result` 是 `PASS`。

## 当前 blocker

- 无真机 target：`hdc list targets` 返回 `[Empty]`。
- 默认 HAP 是 `entry-default-unsigned.hap`。
- `build-profile.json5` 没有 real-device signing config。

在这些 blocker 清除前，real-device evidence 只能记录为 `no evidence yet`。
