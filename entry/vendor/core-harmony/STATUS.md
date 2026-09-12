# Harmony binding 审计状态

2026-08-12 最终生成包 identity 为 Core
`a8baff73e2e4ba94b28b702512f2100a220a84fa`、`gitDirty=true`；SDK 38 个测试通过，NAPI 构建
通过，NAPI SHA-256 为 `b060f46b21cce0ff05259fd23a6b48d228bdbb43adf2ded79f47132341ead61b`。

HarmonyOS App 源 NAPI 已与该字节一致；但 dirty 构建不可作为发布基线，且 Core 最终门禁为红。
本状态只覆盖 binding，不覆盖 VM 或真机。
