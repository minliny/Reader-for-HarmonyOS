# libreader_core_napi.so — Provenance Record

> 记录 `libreader_core_napi.so` 的来源、构建信息和完整性校验。
> 禁止使用无来源旧二进制；任何替换必须更新本文件。

## 当前产物

| 项 | 值 |
|---|---|
| 文件 | `entry/libs/arm64-v8a/libreader_core_napi.so` |
| SHA-256 | `99ffba3e140a7b963b1cb631e5542f24614626c49a3bb68b232684eb9280bac6` |
| 大小 | 12,377,928 bytes |
| ABI | arm64-v8a |
| 构建时间 | 2026-07-10 14:58 |

## 来源

| 项 | 值 |
|---|---|
| 源仓库 | `/Users/minliny/Documents/Reader/Reader-Core-Native` |
| 源 commit | `cce6c774aa7df829c15a823377669d2864eb8db6` |
| 源分支 | `native-sdk-v89-alpha` |
| 源产物路径 | `target/harmony-napi/arm64-v8a/libreader_core_napi.so` |
| 源产物 SHA-256 | `99ffba3e140a7b963b1cb631e5542f24614626c49a3bb68b232684eb9280bac6` |
| 完整性校验 | ✓ HarmonyOS 内置 .so 与 Core target/ 产物 SHA-256 一致 |

## 构建环境（来自 Core target/harmony-napi/arm64-v8a/harmony-napi-build-evidence.txt）

| 项 | 值 |
|---|---|
| Rust target | `aarch64-unknown-linux-ohos` |
| Rust 编译器 | rustc 1.96.0 (ac68faa20 2026-05-25) |
| CMake | 3.28.2 |
| Ninja | 1.12.0 |
| OHOS SDK | `/Applications/DevEco-Studio.app/Contents/sdk/default` |
| Toolchain | `ohos.toolchain.cmake` |
| 构建脚本 | `scripts/build-harmony-napi.sh`（两阶段：Rust 静态库 + CMake NAPI 链接） |
| Rust 静态库 | `target/aarch64-unknown-linux-ohos/release/libreader_core.a` (SHA-256 `1fb55324dbf0d3bb0d2fd76843ddff4f1d01e67a9b08a66ba945cdca57da4a65`) |
| SDK smoke | pass |

## Core 工作树状态

| 项 | 值 |
|---|---|
| HEAD commit | `cce6c774aa7df829c15a823377669d2864eb8db6` |
| 工作树状态 | **CLEAN** — 0 个未提交文件 |
| .so 是否包含 dirty 改动 | **不适用** — 工作树已 clean，.so 基于 HEAD 构建 |

## 变更历史

| 日期 | 事件 | 旧 SHA-256 | 新 SHA-256 | 源 commit |
|------|------|------------|------------|-----------|
| 2026-07-07 | 初始构建 | — | `b65775603bde...` | `16839c967` |
| 2026-07-10 | Core 收口 commit + 重建 | `b65775603bde...` | `99ffba3e140a...` | `cce6c774` |

## 重建步骤

```bash
cd /Users/minliny/Documents/Reader/Reader-Core-Native
# 1. 确保 Core 工作树 clean（git stash 或 commit 所有改动）
git status --porcelain  # 应为空

# 2. 记录 commit hash
git rev-parse HEAD

# 3. 构建
export OHOS_SDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk/default
rustup target add aarch64-unknown-linux-ohos
./scripts/build-harmony-napi.sh

# 4. 拷贝到 HarmonyOS 仓库
cp target/harmony-napi/arm64-v8a/libreader_core_napi.so \
   /Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/libs/arm64-v8a/libreader_core_napi.so

# 5. 更新本 PROVENANCE.md 的 commit / SHA / 构建时间
shasum -a 256 /Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/libs/arm64-v8a/libreader_core_napi.so
```
