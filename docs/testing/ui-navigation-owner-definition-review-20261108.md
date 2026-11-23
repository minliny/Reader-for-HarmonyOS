# navigation-owner 精确检查定义审查

日期：2026-11-08。精确身份为 `H-architecture-shared-producers#navigation-owner`，声明位于 `contract-case-manifest.json.files['test-architecture-shared-producers.mjs'].cases['navigation-owner']`。本文只审这个现有 case，不延伸到其它同名 case、兄弟 case、完整导航验收或发布资格。

本轮完整读取了主 case、下列实际 helper 及装配边，未修改原测试、helper、生产代码、旧 review、manifest 或 gate 批准。当前登记仍是 **NEEDS_EVIDENCE / 默认 OFF**；下述结论供独立复审及有限登记使用，不是自行放行。原精确命令已单独执行，通过结果见[本地证据](../../../.local/ui-navigation-review-20261108/navigation-owner-attempt1.log)。没有运行 VM、Native、HAP 构建、宽屏或兄弟 case。

## 实际定义闭包

主入口 `tools/test-architecture-shared-producers.mjs` 仅由 `contract-case-selection.mjs` 接受显式 `--case navigation-owner`。无参数或 `--list` 只列清单，未知、重复和含空白的选择失败；结果只在该 case 返回后记录。

实际执行树如下。这里区分执行的 helper 定义与作为被测输入读取的生产源码；不能把真实源码加载称为完整 ArkTS 类型检查或真实 Host I/O。

```text
test-architecture-shared-producers.mjs / navigation-owner
├─ contract-case-selection.mjs
├─ shared-producer-inputs.mjs                 [公共 setup 导入；本 case 不调用验证函数]
│  └─ ets-compiler-runtime.mjs
│     └─ tool-environment.mjs
│        └─ scripts/lib/harmony-toolchain.mjs
│           └─ scripts/lib/development-environment.mjs
├─ 直接生产模块
│  ├─ ReaderNavigation.ts                   [含 ReaderReturnNavigation 和目标判定函数]
│  ├─ ReaderLibraryAcquisitionBinding.ts
│  ├─ ReadingEntryDto.ts
│  └─ BookRemovalDialogPresentation.ts
├─ selected-production-methods.mjs          [同一 SDK AST 选取真实 Index 普通方法]
├─ reading-entry-presentation-probe.mjs      [实际 ReadingEntryPresentation，去类型/Observed]
│  ├─ ErrorMessage / LogPrivacy / ReadingFailurePresentation
│  ├─ ReaderBookmarkAnchorRequest / ReaderDirectoryBackfill
│  │  └─ ReaderDirectoryNavigation / ReaderDirectoryDisplayMetadata
│  ├─ MangaBookPresentation
│  └─ ReadingBookDetail
├─ bookshelf-operation-owner-probe.mjs       [同一 SDK 编译真实完整普通类，移除 import]
│  ├─ ReaderReadingEntryActions / ReaderExitActions
│  ├─ ReaderLibraryJourney / ReaderSettingsJourney / ReaderDownloadJourney
│  ├─ ReadingBookDetail.downloadBookFromReadingDetail
│  └─ 模块顶层实际导入的只读/投影/错误合同
│     BookshelfReadOwner / ReaderOperationFacts / ReaderSourceCategory /
│     BookshelfSourceNameProjection / BookRequestScheduler / ReaderWriteEvidence /
│     vendor reader_core.ts
├─ reader-directory-operations-probe.mjs
│  ├─ ReadingOfflineContract / ReaderRecoveryProjection
│  ├─ ReadingOfflineFailurePresentation / ReadingDirectoryRecovery
│  ├─ 真实 ReaderDirectoryOperations / ReaderDirectoryJourney
│  └─ 真实 Index.directoryJourneyPorts
├─ ets-pure-module-probe.mjs                 [同一 SDK 编译两条 parent 丢失变异]
└─ json-import-presentation-probe.mjs        [实际 JsonImportPresentation，仅装配模态状态]
```

SDK 定位没有独立硬编码探针环境：上述入口共用 `installedEtsCompiler → resolveEtsLoaderRoot → resolveHarmonyTool`。本次读取身份为 DevEco bundled Node `v24.14.1`、SDK ETS loader 中 TypeScript `4.9.5`；实际路径与[身份记录](../../../.local/ui-navigation-review-20261108/sdk-identity.log)绑定。工具链 resolver 允许显式 SDK 配置并在配置无效时失败，不借用另一个预编译测试结果。

完整清单见[helper 静态导入闭包](../../../.local/ui-navigation-review-20261108/static-helper-import-closure.json)和[34 项实际生产输入](../../../.local/ui-navigation-review-20261108/production-inputs.json)。静态导入清单只是本次阅读回执，不是新增检查器。`bookshelf-operation-owner-probe` 中未调用的 Host/事务类工厂不因同文件定义而执行；生产类中被移除的 import 也不能算已执行的系统文件、Core 或 Native 实现。`shared-ui-boundary` 只在兄弟分支动态加载，不属于本 case 的运行定义。

## 装配方法与受控端口

- `selectedProductionMethods` 要求每个具名成员只有一个真实声明，拒绝 Builder，只编译实际普通方法及属性初始化器。本 case 选取 Index 的 Runtime/导航发布、Entry/Exit/Library/Settings/Download ports、远程详情与完整目录入口。目录 helper 另选取同一 Index 的 `directoryJourneyPorts`。没有手写旧 Index 导航算法。
- `bookshelfOperationClass` 编译当前生产普通类；`pureModuleProbe` 要求真实 SDK parse/emit 无诊断，并按源码和 SDK 等身份缓存未绑定工厂。它们不是 ArkUI 控件 lowering 或类型全编译，不证明 `@Observed` 运行通知。
- `actualReadingEntryPresentation` 保留实际 Presentation 方法、字段和回调身份，去除 import、类型和类装饰器。阅读 Host 的 `forRuntime/openLocal/openRemote/snapshot` 在下载开章和远程详情交接场景由明确受控发布端口提供，检查 lease 和完整交接参数。它没有执行真实 ReadingEntryHost、Core、存储、网络、正文准备或保存 ACK。
- acquisition coordinator、搜索可见性、窗口绑定、列表刷新和导航发布均为显式记录端口。后半 Index return 场景对 `resumeShelf/openShelfEntry` 的受控替换只验证路由/恢复顺序；前面的 local/remote 下载开章子矩阵另行使用真实 Actions、Presentation、Navigation，避免由这些替换伪造父项保留。
- 目录操作 helper 的默认 Host `forRuntime` 返回 undefined，intent 类没有成功写入实现。本 case 只消费目录装配/开窗/展示代次，不执行书签或离线事务；这些默认端口不是提交成功回执。`ReaderExitActions.mountSystemFile` 不在此 case 中调用，系统文件优先级仅通过导航 owner 的 claim/deliver 端口验证，不等于队列、原生文件或冷恢复验证。

本执行闭包没有触发 Core CLI、NAPI、Native build、网络 fixture、HAP、VM 或系统 UI；`resources: []` 合理，但仍要求可用 Node、实际 SDK 解析器以及当前生产输入。日志只能证明上述受控执行范围。

## 正反覆盖与边界

| 真实被测边 | 同 case 保留的拒绝/失败条件 |
| --- | --- |
| 同 Runtime acquisition root 替换与订阅 | 旧 listener、旧 dispose、旧 visibility/beginSearch 均不能操作后继；当前 root 仍刷新当前投影 |
| 导航 snapshot、advance 与准入 | 原 snapshot 不被后续写入；错误 route/拒绝 admission 不打开搜索或多选；settings section 与原返回目的地保留 |
| 临时返回与目录归属 | 旧 identity 清理不删除当前 handler；native/modal 优先；切路由后旧 handler 不消费；readerControl/detail 目录与保存退出目的地区分 |
| 阅读退出决策与一次性结算 | 下载/详情/规则/书架准备及系统文件优先级；取消、错误 reader/book/Runtime、重复 accepted receipt 不推进旧目的地 |
| 下载 local/remote 开章与原详情父项 | 实际首次 capture 即保留 search；reading-origin、reader-detail-origin、拒绝后重试均保留原上下文；分别删除 local/remote 真实 parent 参数的两条源码变异必须被原断言捕获 |
| 实际 Index 与 Journey 恢复接线 | 旧 root 不接受退出，未注册保存交接不保留规则请求；晚到开章不改现有 reader；拒绝后不展示目录；旧 Runtime 不能消费 retained return |
| 远程详情交接时序 | audio 不推进 route/Host；advance 后才投影新类型与当前 shelf/candidates；原 retained/validated session、cover 与 fallback 交付不丢失；下一次开页使旧 lease 失效 |
| 根 route 写点退出 | 对当前 Index 具名写入模式检查只有 publishNavigation 写投影，且现行 show/advance、exit 委托和旧字段退出存在 |

最后一行是有限源码形状约束：它没有做全程序别名分析，不能据此证明任意新语法或间接写入永远不存在。其它拒绝条件由实际 owner/装配执行断言验证；除了明确列出的两条 parent 变异，没有宣称逐个生成并执行所有可能 mutant。这里不含 SourceJourney UI、所有返回组合、真实保存失败/冷恢复、IME、焦点、无障碍、布局或宽屏验收。

## 选择、登记与独立复审

本次原命令为：

```text
node tools/test-architecture-shared-producers.mjs --case navigation-owner
```

实际日志恰好一条 `reader-contract-case-result`，case 为 `navigation-owner`、状态 PASS。它是当前定义复审中的直接执行回执；尚不能称为经 QUALIFIED gate 分派的结果。未运行兄弟 case，未改其批准身份。

当前合法登记约束来自现有代码：

- `gate-index.mjs:118` 的 `verifyDefinitions` 要求精确叶 QUALIFIED、非空 `definitionInputs` 且逐项摘要一致；不满足时失败，不扩大为父项或全套。`gate-index.mjs:193` 起另要求已冻结 catalog、明确 change 和精确选择。
- `gate-index.mjs:123` 当前把 `resourceDefinitionSha256` 绑定到 manifest 的整份脚本记录，包含兄弟 case 声明。因此只调整本 case qualification 也会改变该共享摘要；若独立复审同意有限登记，必须明确处理既有两个叶的资源声明摘要联动，不能把这种联动写成重新批准或顺带放行其它 case。
- `run-contract-tests.mjs:324` 的 `contractCaseSelection` 要求准确脚本/case 已公布且 QUALIFIED、脚本摘要一致和资源已审。`caseReceipts:353` 要求回执与显式选择完全相同，缺少、重复和多出任何 case 都失败。runner 的静态 nested-test 导入扫描不等于执行兄弟分支。
- 旧共用 review 本身已是另两个叶的冻结输入。本次使用独立新 review，不改旧字节。若本 case 测试代码或共用 helper 以后变化，应复审相应受影响定义；不能仅改摘要消除拒绝。

本次审查认为：**这个有限 case 的实际定义、依赖、负例和资源边界已足以提交独立复审；可在复审同意后仅推进该精确叶的可选择资格。** 具体摘要列表见[definition-inputs.json](../../../.local/ui-navigation-review-20261108/definition-inputs.json)，登记前状态见[registration-before.json](../../../.local/ui-navigation-review-20261108/registration-before.json)。资格及默认 OFF 由根任务按既有审核流程决定；本报告没有执行批准或变更 manifest/gate。

普通构建、安装和发布不因此自动执行导航检查。精确叶 QUALIFIED 也不能代替完整产品验收；真正经原 `gate-index --id H-architecture-shared-producers#navigation-owner --run --change ...` 分派的结果须在有限登记后另行记录，不能将本次直接 PASS 冒记为该结果。
