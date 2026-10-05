# R5 published 构建绑定

新增绑定目录，不改 R4 父档、R5 delta、delta manifest 或既有冻结证据。

- 规范 run：`20261003T123734Z-568ec4e3-52338352`。
- manifest SHA-256：`34ff8b60a7892cf502dd0407a31dd189c22c7d68b94c20f2f8b1d0cb2fd78c5e`。
- signed HAP SHA-256：`f00ebc4a15240832ee5decf39f660cf30eafcf7454759c85875dd94af4f74719`。
- 分类为 `iteration`，`acceptanceEligible=false`；源码 origin 是冻结的独立临时交付树。

`binding.json` 绑定 R4 父档与 R5 delta、有完整有效源码清单、实际 published HAP 字节、公开签名身份、Core、SDK 和 Native 输入。公开 manifest、三份规范源码快照及两份 Native provenance 已按实际字节保存；未复制私有证书、密钥、Profile 或有效私有构建配置。

逐项重算并核对了 1824 条 Host source、584 条 controller 和 18 条 workspace contract 记录，共 2426 条。路径、type、mode、字节与 SHA 均能从冻结 R4+R5 重建，三个规范 fingerprint 也完全一致。Surface `00087dbd…` 和 SDK gate `d70ab168…` 对应本轮两文件增量。

Core 输入仍为 `9e979194…`，原始 Host／SDK SO 为 `1fabbfa6…`。规范 provenance 明确记录 `llvm-objcopy --strip-all`，HAP 内 Native 输出为 `adb383b3…`；已实际读取 signed／unsigned HAP 内对应条目并验证输出字节和 SHA，未将原始 SO 与打包输出混称为相同文件。

绑定只记录已发布构建／源码关系。没有执行设备操作，没有填 VM、真机、交互或用户验收结果。后续验签、inspect、安装和设备取证由父任务分别记录。

可在原交付临时源已删除后，验证本目录及仍在持久 artifact-root 的 signed／unsigned HAP：

```sh
python3 /Users/minliny/Documents/Reader/.reader-isolated/manga-ui-20261002/Reader-for-HarmonyOS/evidence/2026-10-03-manga-reader-sheets-r5/source-delta/canonical-binding/verify_binding.py --require-artifacts
```

如仅核对已保存公开记录和源码绑定，省略 `--require-artifacts`；程序会明确报告实际可读取的 HAP 数量。R4+delta 的全部归档字节由上一层 `verify_delta.py` 验证，本脚本核对规范快照与其有效源码清单。
