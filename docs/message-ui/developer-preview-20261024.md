# 开发者模式与消息预览

用户于 2026-10-24 明确要求：通用设置中使用「开发者模式」导航入口，进入子页面后提供「消息预览」入口和独立的「显示组件边界」开关，再进入消息提醒预览模块。

## 实现边界

- 在现有 main 工作树中调整 SettingsPage，保留既有 dirty WIP。开发工具页及消息预览沿设置临时返回桥逐级返回，不增加全局路由或业务状态。
- 「显示组件边界」复用原 developerMode 持久化字段、SettingsHost 写入/核对流程和 ReaderLayoutDebugOverlay，保留既有值；该字段不再作为消息预览的准入条件。
- 消息预览直接调用 ReaderTransientFeedback、ReaderRecoveryNotice、ReaderPageState、ReaderDialogSurface；任务示例直接使用 LocalImportDialog。无新 Toast 宿主或原生消息旁路。
- 所有样例明确标注为演示；确认/核对/重试仅改变本地内存。无书籍、下载、导入、缓存或设置业务调用。关闭样例不触碰实际任务。
- 当前样例的 generation 与 previewEnabled/mounted/foreground 联合保护动作。切换、结束、后台或退场清理定时器及本实例反馈；边界按钮回调单独绑定当前开发工具页身份。

## 本轮选择的验证及必要性

1. `.reader-artifacts/developer-message-preview-20261024/probe.mjs`：只用已安装 SDK AST 提取新预览页及 SettingsPage 的相关生产方法，控制计时/反馈平台接口；核对逐级返回、边界开关独立、退场/后台/旧代回调不能污染新样例。无其他测试导入、无 IO 业务或设备动作。必要性：本次引入两级页面和异步演示状态，源码类型检查不能验证回调失效。
2. `node tools/check-message-entrypoints.mjs --check`：只做当前 ETS/TS 消息入口 AST 登记/旁路核对，不编译、不执行业务或嵌套门禁。必要性：本轮新增四类公共消息入口及任务专用组件样例，须核对分类登记。
3. `node scripts/hap-pipeline.mjs build --class iteration`：合同选择 none，仅本次输入及依赖配套、隔离 ArkTS 编译/Native 打包和指定证书签名核验。必要性：新增 ArkUI 子页面、Builder 插槽和组件属性，需真实编译确认。包构建不代表设备视觉或交互验收。

## 结果

首次方法探针使用早期接口名 enabled；当前源码已使用 previewEnabled，导致夹具未准入而失败。已对齐当前属性名后重验，不将夹具错误记为产品回归。入口检查首次失败：新页私有 showToast 方法与平台 API 同名，被保守 AST 规则列为原生旁路。已将私有方法改名 previewToast，继续调用 ReaderTransientFeedback，不放宽公共检查。本轮 9 项生产方法场景及消息入口登记检查均已 PASS。独立源码审查未发现阻断问题；ArkTS 编译、非增量构建、签名及包校验 PASS。未占用或安装真机，交互及视觉验收 OPEN。

## 构建产物

- Run: `20261023T163955Z-6b1bd753-2514070c`；manifest: `.reader-artifacts/hap/20261023T163955Z-6b1bd753-2514070c/manifest.json`。
- Signed HAP SHA256: `e2168754e6a568ca28fe2f0e4fad3c8fc3d609fb57d88459c34be709c45d3252`。
- 指定 minliny_HarmonyOS 证书校验 PASS，Profile 为 debug；无签名切换。
- harmony: `6b1bd7534b61a8ebfac10150fd308eae8430606e`，dirty=True；保留原工作树变更。
- core: `9131ddcfeef1922620c6867f88fe82608e51a079`，dirty=True；保留原工作树变更。
- 本轮两个设置页面的当前字节与构建输入快照一致。完整记录：`.reader-artifacts/developer-message-preview-20261024/delivery.json`。
- 全量合同 NOT_RUN；真机安装 NOT_RUN；设备显示/交互及用户验收 OPEN。未触碰设备和应用数据。
