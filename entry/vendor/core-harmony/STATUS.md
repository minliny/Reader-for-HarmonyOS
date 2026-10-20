# Harmony binding 验证入口

当前事实来自同一次构建的机器证据，本文件不保存历史成功哈希。

- `scripts/build-harmony-napi.sh` 执行真实桌面 NAPI、OHOS 编译和 Bun SDK 门禁。
- `target/harmony-napi/arm64-v8a/core-input-snapshot.json` 由
  `scripts/build-input-snapshot.mjs` 绑定实际 Core 输入，并拒绝未绑定的符号链接。
- `harmony-napi-build-evidence.txt` 将源码快照、build identity、Native 与 package manifest 绑定。
- HarmonyOS 仓库的规范 `sync-native` 同步经过验证的配套输入；新 HAP 继续验证来源与字节。

最终以不可变 HAP manifest 为准。Core、本地 SDK、HAP、设备和用户验收分别记账；
本地整合后的源码不会自动获得旧 Native/HAP 的验证结果。
