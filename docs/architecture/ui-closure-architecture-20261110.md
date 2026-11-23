# UI 收口：几何代次与窗口只读边界（2026-11-10）

本文记录本轮代码定位、实施与证据，不建立第二份待办；任务状态归根目录唯一待开发清单。

## 定位与边界

- G-L1：当前 `ReaderStandardPage` 在 viewport/窗口 revision/rail 输入变化时递增测量代次，却通过 `ReaderMeasurementStore.read` 读取上一代头尾高度。旧回执拒绝写入不能证明新布局未消费旧测量。代码侧可以复现，尚未将此路径认定为已观察到的像素故障。
- 窗口环境：公共 UI 原来直接引用 `app/ReaderWindowCoordinator.metrics()`。这些调用读取环境事实，不是业务 owner；此次只抽出只读访问端口，原 coordinator 继续独占窗口操作、snapshot 和 `readerWindowMetricsRevision` 发布，不建立新的环境状态或订阅中心。
- 领域页面：原生 List/Grid/阅读等继续由其具名宿主消费同一几何合同。`SourceManagementPage` 的 Scaffold + List、稳定 key、锚点及有效代次读取保持原样，不为减少 Scaffold 数量套入标准 Scroll。
- 阅读动效：生产仍由 `LocalReadingExperience → ReaderControlPanel` 承载；`ReaderControlMotionStage` 仅供 `ReaderControlMotionVerification` 使用。实验组件存在不代表生产已经接入，也不代表当前生产有两个竞争时钟。本轮登记用途，不强接实验 Stage、不修改阅读手势或翻页算法；后续替换须以原会话、临时层、返回、IME、TTS、中断、减少动效及卸载等价证据为前提，再退出对应旧生产路径。

## 本项显式检查计划

所有入口默认仅列清单、记 `NOT_RUN`；只执行下列准确 case。不运行全量、构建、签名或设备。

| 实际入口 | 嵌套调用与范围 | 保护风险及本次必要性 |
| --- | --- | --- |
| `node tools/test-ui-window-layout-closure.mjs --case standard-page-generation` | `selectedProductionMethods` 用已安装 ArkTS SDK 解析并执行 StandardPage 当前普通生命周期/几何方法；`actualReaderPageLayout` 加载当前 Geometry/Measurements 等有限纯模块。无其他测试或子进程。 | 本轮改变测量读取，必须证实新代次 fallback、旧回执拒绝、当前回执收敛、rail/底部预算及卸载重挂；只测 helper 无法发现页面仍调用旧读法。方法探针不证明 ArkUI 像素或原生调度。 |
| `node tools/test-ui-window-layout-closure.mjs --case window-environment` | 已安装 ArkTS SDK emit 实际端口与 coordinator 模块；仅窗口/平台 I/O 为显式假端口，不安装/启动窗口；检查公共 UI import 的实际 AST。无其他测试或子进程。 | 本轮改公共环境接线，必须证明消费同一个 coordinator snapshot、实时替换仍透传、不能重绑另一个 owner，且公共 UI 不再引用 app owner。emit 不冒充完整 ArkTS 类型检查。 |
| `node tools/test-architecture-shared-producers.mjs --case ui-boundary` | 当前 ArkTS AST 边界检查及本 case 的有限 import/re-export/facade/dynamic-import 反例；读取当前共享 UI/平台文件，不执行同文件其他 case 或业务测试。 | 公共 UI 已迁出 app metrics 引用，必须退役原 coordinator 只读特例，并验证 UI 无法绕读端口取得 app owner 或环境绑定能力。本 case 本轮已重新审读，直接显式执行不声称旧封存索引指纹已准入，且不重拍指纹。 |

工具缺失、执行失败或缺回执保持 `FAIL`/未完成，不能自动安装工具、扩大检查或改记通过。当前历史 `test-reader-page-header-contract.mjs#standard-page-layout` 使用旧 `contentFrame()` 与只含 width 的 viewport 回调假设，不作为本项有效回归；本轮不执行或扩大修改该历史 case。

## 结果

- 代码定位：已确认跨代次读取路径。
- `standard-page-generation` 修前：FAIL（resize 后旧 header `93` 被读入新代次，fallback 应为 `58`）；修后：PASS。只证明当前普通方法、共享几何与生命周期，不证明像素表现。
- `window-environment`：PASS。实际 coordinator 的 `refreshMetrics()` 通过假 Window/display I/O 发布真实 snapshot/revision；只读端口返回同一对象，平台变化后立即读取新对象，重复读取/等值事件不新增 revision，第二个绑定被拒绝；当前公共 UI import AST 无 app owner 边。
- `ui-boundary`：PASS。原 coordinator 例外已退出；实际 UI/平台范围与显式读端口正例、app owner/环境绑定/转发与动态导入反例均通过。本轮直接点名执行，未修改封存索引定义指纹或扩大其他 case。
- 共享 SDK/method 假窗口组合仅适配依赖注入：原 fixture 的显式 metrics I/O 经过实际只读端口；每个 fixture 独立绑定，不放松原断言或引入第二份生产状态。其他历史 case 未执行。
- 完整 ArkTS 类型检查、包、设备像素和用户验收：本项未执行。
