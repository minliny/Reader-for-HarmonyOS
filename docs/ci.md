# Harmony 持续验证

`Harmony contract gate / contract-gate` 在一次性 Ubuntu runner 上执行当前合同测试。
它检出相邻的 `minliny/Reader-Core-Native` 并构建 CLI，下载经 SHA-256 验证的官方 SDK，运行现有
生产方法、ArkTS 编译探针和 Native 几何测试，最后审计 Hvigor 包管理器。不能将此 job 当作 HAP、签名或设备验收。

仓库管理员需配置：

- secret `HARMONY_TOOLS_URL`：有权访问的官方 Linux command-line tools 下载地址；不提交到 Git 或日志。
- variable `HARMONY_TOOLS_SHA256`：该完整 ZIP 的已确认 SHA-256。更换工具版本时一并更新。
- 私有 Core 仓库需要 secret `READER_CI_READ_TOKEN`，只授予读取该仓库内容的权限；公开仓库可使用默认 token。
- variable `READER_CORE_REF` 可固定匹配的 Core commit/ref；默认 main。跨仓变更需要先发布 Core 再验证 Harmony。

缺少必要下载配置时 job 明确失败，不跳过测试。不要把外部 PR 指向持有用户数据的 fnOS 自托管 runner。
发布工作流后，将该 job 设为分支保护所需检查；工作流文件本身不能证明远端规则已启用。

本地复现：配置 `READER_ETS_LOADER_ROOT`、`READER_HVIGOR_PLUGIN_PACKAGE`、
`READER_ARKUI_PREVIEW_RUNTIME`，保证相邻 Core 的 `target/debug/reader-cli` 已构建，执行
`bash scripts/check-local.sh`。Linux 构建使用 `HAP_BUILD_SYSTEM.md` 中的唯一 pipeline。
