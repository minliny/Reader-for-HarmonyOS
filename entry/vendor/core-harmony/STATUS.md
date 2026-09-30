# Harmony binding 审计状态

## 当前整合状态（2026-09-30）

当前仅完成本地源码整合。尚未针对这组整合源码构建或同步匹配的 OHOS Native、SDK 和 SO；候选源码目录没有 Core SO。没有本轮 HAP 构建、签名、安装、设备行为或用户验收证据。

保留的 SDK 源文件用于合同审计，不表示已生成与当前 Core 提交匹配的交付包。后续必须以规范 pipeline 的输入快照、SDK smoke 和 provenance 验证真实配套；不得复用下述历史 SO 作为当前输入。

## 历史记录（仅覆盖 2026-08-12）

当时最终生成包 identity 为 Core `a8baff73e2e4ba94b28b702512f2100a220a84fa`、`gitDirty=true`；SDK 38 个测试通过，NAPI 构建通过，NAPI SHA-256 为 `b060f46b21cce0ff05259fd23a6b48d228bdbb43adf2ded79f47132341ead61b`。

当时 App 源 NAPI 与该字节一致；该 dirty 构建不能作为发布基线，且当时 Core 最终门禁为红。此历史记录只覆盖当时 binding，不验证当前源码、VM 或真机。
