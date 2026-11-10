# @reader/core-harmony

Rust Reader Core 的 HarmonyOS NAPI/ArkTS 包。源码入口为 `native/reader_napi.cpp`、`Index.ets`
和 `sdk/`；`scripts/build-harmony-napi.sh` 默认构建原生库并生成可复制包，测试状态记为 `NOT_RUN`。
仅预先说明必要性后，分别用 `--host-probe` 和 `--sdk-smoke` 显式运行真实宿主 NAPI 探针和 Bun SDK 测试；
两个选项互不自动包含。源码快照、build identity、Native 与 package manifest 的校验继续保留。

此包通过不代表 HarmonyOS App 通过。消费端仍须验证包内 Core identity、NAPI SHA-256 和最终
HAP SHA-256 是同一构建链。
