# Harmony binding 验证入口

本文件不保存时点状态或历史成功哈希。当前事实来自同一次构建的机器证据：

- `scripts/build-harmony-napi.sh` 执行真实桌面 NAPI、OHOS 编译和可用的 Bun SDK 测试。
- `target/harmony-napi/arm64-v8a/core-source-snapshot.json` 绑定实际 Core 输入字节，包含 dirty 修改。
- `harmony-napi-build-evidence.txt` 将源码快照、build identity、Native 和 package manifest 绑定。
- 在 Harmony 仓运行 `node scripts/hap-pipeline.mjs sync-core` 同步经过验证的 package。
- 所有新 HAP 在编译前后验证 Core 输入与两份应用库一致，并记录 HAP 去符号后的来源证明。

最终以不可变 HAP manifest 为准。iteration 允许 dirty/unsigned；设备安装和正式验收仍有独立门禁。
