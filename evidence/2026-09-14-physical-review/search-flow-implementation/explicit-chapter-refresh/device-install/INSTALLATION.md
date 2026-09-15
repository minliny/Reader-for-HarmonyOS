# 正文刷新修复版真机安装

用户授权重新安装到真机。当前唯一物理目标已现场发现，targetRef `b1f20b88963d`，共享 HDC lease 串行操作、完成后释放。

- Run：`20260915T114122Z-13fa3794-46864a8d`。
- Harmony：`13fa3794dee54c2e5752dce2bc90f868db1ddbda`，构建时仅已重建 Native 二进制 dirty；Core：`2e5a3504d98d947a7b04e79e6d51203ef44d10ac`，clean。
- HAP SHA-256：`b67fff0a0247723bccf9d479cc39816cbb94b0bc5b34ceb6d040f3cfd5e6ec09`，verified signed/debug，iteration/acceptanceEligible=false。
- Native 输入 SHA-256：`90a9847f1c3b23cfadb3a9582e2eb66bbe2373e0a006e2ca01c068bcdcba055d`。
- [manifest](manifest.json)、[Native](native.log)、[正式构建](build.log)、[签名身份预检](inspect.json)。268 合同、ArkTS、隔离构建及 Native/签名校验通过。

第一次构建的两处 ArkTS 对象展开失败保留在 [原日志](build-failed-arkts.log)，随后显式复制全部书签字段修复，不把失败包称为可安装产物。

安装流水线已完成覆盖写入和安装后身份检查；随后启动遇到 `10106102`：设备锁屏，开发模式不允许自动解锁。[实际输出](install-launch-locked.log)。书籍、书源及设置采用 preserve 数据策略，未卸载或清数据。此时启动尚未完成；当前流水线在启动失败后退出，未生成完整部署回执，不能把安装/启动组合层写成 PASS。已提示用户解锁；未执行任何功能测试。
