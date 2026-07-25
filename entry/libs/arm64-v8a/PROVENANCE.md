# libreader_core_napi.so — Provenance Record

> 记录 `libreader_core_napi.so` 的来源、构建信息和完整性校验。
> 禁止使用无来源旧二进制；任何替换必须更新本文件。

## 当前产物

| 项 | 值 |
|---|---|
| 文件 | `entry/libs/arm64-v8a/libreader_core_napi.so` |
| SHA-256 | `be7b16b34fa92553fe0f08742adde52eee9d414410ab4d1523a38547e3a056df` |
| 大小 | 13,901,976 bytes |
| ABI | arm64-v8a |
| 构建时间 | 2026-07-24 18:01 |

## 来源

| 项 | 值 |
|---|---|
| 源仓库 | `/Users/minliny/Documents/Reader/Reader-Core-Native` |
| 源 commit | `7a0718a4fb083a2cadfba061536ab82edb49d614` |
| 源分支 | `native-sdk-v89-alpha` |
| 源产物路径 | `target/harmony-napi/arm64-v8a/libreader_core_napi.so` |
| 源产物 SHA-256 | `be7b16b34fa92553fe0f08742adde52eee9d414410ab4d1523a38547e3a056df` |
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
| Rust 静态库 | `target/aarch64-unknown-linux-ohos/release/libreader_core.a` (SHA-256 `e91783d864a3166adc2bbeb7ca63a1d766ff3ef11cdc9cf54c18d4af2b785407`) |
| SDK smoke | pass |

## Core 工作树状态

| 项 | 值 |
|---|---|
| HEAD commit | `7a0718a4fb083a2cadfba061536ab82edb49d614` |
| 工作树状态 | **DIRTY** — 构建时有 27 个未提交文件；依用户指令未提交、未 stash、未 reset |
| .so 是否包含 dirty 改动 | **是** — 包含本轮未提交的 `bookshelf.removeBatch` Core 实现；不得将此记录表述为 clean release 产物 |

## 本轮 HAP 打包校验

| 项 | 值 |
|---|---|
| HAP | `entry/build/default/outputs/default/entry-default-unsigned.hap` |
| HAP 内 native 库 SHA-256 | `50b322d8ca19b6cddf463ce93f26772b4349ee2f769f6560ea100b3db2bee2a3` |
| Strip 后 Build ID | `3e7d41b11a137504afd3ee63b9ea5cb621d16f46` |
| 源 `.so` Build ID | `3e7d41b11a137504afd3ee63b9ea5cb621d16f46` |
| 结论 | ✓ HAP 使用的是本表记录的 `.so` 的 strip 产物；strip 会移除 debug 段，故 HAP 内字节 SHA 与输入 `.so` 不同 |

## 变更历史

| 日期 | 事件 | 旧 SHA-256 | 新 SHA-256 | 源 commit |
|------|------|------------|------------|-----------|
| 2026-07-07 | 初始构建 | — | `b65775603bde...` | `16839c967` |
| 2026-07-10 | Core 收口 commit + 重建 | `b65775603bde...` | `99ffba3e140a...` | `cce6c774` |
| 2026-07-24 | 为 HarmonyOS 静态集成重建（未提交工作树） | `5a8b29c7decc...`（替换前实际内置库；旧记录曾误列 `99ffba3e...`） | `be7b16b34fa...` | `7a0718a4` + 未提交的 batch-remove 改动 |

## 重建步骤

```bash
cd /Users/minliny/Documents/Reader/Reader-Core-Native
# 1. 发布构建前确保 Core 工作树 clean（本轮为未提交的静态集成构建，不能复用为 release 证据）
git status --porcelain  # 发布构建时应为空

# 2. 记录 commit hash
git rev-parse HEAD

# 3. 构建
export OHOS_SDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk/default
rustup target add aarch64-unknown-linux-ohos
./scripts/build-harmony-napi.sh

# 4. 拷贝到 HarmonyOS 仓库
cp target/harmony-napi/arm64-v8a/libreader_core_napi.so \
   /Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/libs/arm64-v8a/libreader_core_napi.so

# 5. 更新本 PROVENANCE.md 的 commit / SHA / 构建时间；若工作树不 clean，必须如实记录 dirty 状态和原因
shasum -a 256 /Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/libs/arm64-v8a/libreader_core_napi.so
```
