# @reader/core-harmony

Rust Reader Core 的 HarmonyOS NAPI/ArkTS 包。源码入口为 `native/reader_napi.cpp`、`Index.ets`
和 `sdk/`；`scripts/build-harmony-napi.sh` 构建原生库、运行 SDK 测试并生成可复制包。

此包通过不代表 HarmonyOS App 通过。消费端仍须验证包内 Core identity、NAPI SHA-256 和最终
HAP SHA-256 是同一构建链。
