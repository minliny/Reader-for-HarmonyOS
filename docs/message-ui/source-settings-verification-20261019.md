# 来源、设置与 JSON 消息样式验证（2026-10-19）

> 2026-10-20 门禁退出说明：本文保留当时的执行记录，其中已列入 `tools/retired-contract-tests.json` 的旧测试命令已退役，不能重跑或恢复为当前入口。现需回归时按工作区 `GATE_INDEX.md` 选准确项；历史 PASS 不转移为当前源码结论。

依据 `approved-scope-20261019.json` 和其中用户已确认的六类 demo 实施。本记录仅证明源码及本机 SDK 消费者行为；完整 ArkTS/HAP 编译由总交付记录单独绑定，未执行设备安装、像素取证或用户验收。

## 实施范围

| 原编号 | 当前接线与边界 |
| --- | --- |
| B09 来源管理 | 首次读取等待、失败、确定为空使用 `ReaderPageState`；已有列表在普通刷新失败时保留并短时反馈，保留只读刷新及导入后的重新搜索入口。真实原操作待核对/继续使用顶部 `ReaderRecoveryNotice`，原 generation、operationId 与准入不变。正常来源卡、类别、来源标签和逐源状态点未改。 |
| B10 批量检测 | 保留实际 completed/total、真实百分比、当前源、通过/失败/错误/剩余计数和原 stop 动作。结果行完整展示来源 ID 与消息，不限制单行；采用批准消息标题与内容卡样式。 |
| B11 书源工具 | 原操作未知/收尾未完成使用顶部独立动作卡。确认已保存但读取失败仅短时反馈，保留只读重新读取入口及草稿。检测详情独立序号列、完整检测对象、原消息换行、原 state 码；失败仅小标签使用危险色。 |
| A07 / JSON 表单 | 空地址、非 HTTP/HTTPS 地址校验留在原表单，保留原输入；共享正文/说明与校验字体分层。异步导入回执、Index 弹窗生命周期由 Index 所有者单独覆盖。 |
| B12 设置 | 清理前说明清理正文/正文图片及保留范围；确认前不下发。清理/恢复使用原事实与原生 32vp 等待指示，无伪造进度。已知结果短时反馈，真实待核对清理和未确认保存分别使用顶部卡及原动作身份。普通刷新保留现值与只读刷新入口。 |
| A01 / Discover 补漏 | 普通刷新失败/部分结果且已有内容时保留旧结果并短时反馈；首次结果区等待、失败、空态使用公共页态。保留原来源/分类/页码身份与刷新、分页入口，未改正常来源卡和标签。 |
| C01 换源完成短提示 | 使用批准短反馈字级及日夜色；保留原正文已就绪触发、2200ms 生命周期、wash、纸张主题和安全边距。 |

B15 下载清理说明与 B18 书架设置由相应页面所有者完成；本子任务未越界实现。RSS/Sync 等关闭模块保持关闭，未新增通知中心、权限、重试、任务或系统后台能力。

## 本地验证结果

以下命令均已通过，执行形式为 `node tools/<文件名>`：

| 测试文件 | 证据范围 |
| --- | --- |
| `test-source-tools-receipt-consumers.mjs` | 真实 Gateway→Owner→Index→SDK 的 CRUD、编辑、部分提交、未知回执、只读重试、关闭/重开、旧回调和退役边界 |
| `test-source-tools-original-recovery-sdk.mjs` | 完整装饰 Page 与实际公共恢复组件；4 组冷恢复/清理/保留回调/忙态，不替换写操作，显式继续保留完整原 ID |
| `test-source-foundation-specs.mjs` | 32 组原普通控件 SDK 元组/回调，12 组响应式宽度及退役动作 |
| `test-source-management-cold-owner.mjs` | 两种真实冷启动域 Owner，5 组原 Host 身份/无替代写入 |
| `test-source-host-wiring.mjs` | 来源 Host 分发与投影接线 |
| `test-source-index-presentation-consumers.mjs` | 11 组真实 Host→Index→SDK：编辑/JSON、本地文件、ACK/未知、原重新搜索动作、旧 presentation 拒绝与负对照 |
| `test-source-management-typography.mjs` | 正常来源元信息原字体元组保持 |
| `test-source-tools-typography.mjs` | 原始视觉 fixture 保留；正常控件及 5 个公共 carrier 保持，消息后继角色符合批准元组 |
| `test-source-tools-typography-sdk.mjs` | 实际 SDK 消息字级/日夜重放、输入和动作准入；长 ID、原消息换行、独立序号、原 state 与仅失败标签红色 |
| `test-source-message-feedback.mjs` | JSON 本地校验不清空输入；Toast 一次投影去重，未知结果/首次失败/退役不误发短反馈 |
| `test-settings-cache-owner-consumer.mjs` | 实际缓存 Gateway→SettingsHost→Index Props→SDK/CategoryRow：确认前无派发、取消不可复用、重复点击、未知/畸形回执、重新挂载、延迟 ACK 与 Runtime/nav 退役 |
| `test-settings-cache-cleanup.mjs` | 11 项文字缓存范围与受保护存储 Owner 接线 |
| `test-settings-host-wiring.mjs` | 设置 Host 与惰性 context 接线 |
| `test-settings-index-presentation-consumers.mjs` | 10 组 Preferences→Owner→Index→SDK：普通开关、设置/书架设置未知保存、纯读取核对、原保存继续、旧回调与负对照 |
| `test-settings-select-overlay.mjs` | 原设置选择浮层的响应式契约 |
| `test-portable-json-import.mjs` | JSON 本地/在线导入边界 |
| `test-discover-operation-consumers.mjs` | 来源/分类/分页、旧内容与身份保留、部分/空数据、纯读取重试、关闭/重开、旧回调与并发 |
| `test-discover-product-flow.mjs` | 原发现来源过滤和分页契约 |
| `test-rss-discover-responsive-layout.mjs` | Discover 原响应式宽度/安全边距；共用宿主原 RSS 消费者不变 |
| `test-source-switch-visual-sdk.mjs` | 96 个 manga/text 自适应 profile，日夜和大字号、原换源交互/动画/取消/字体准入，以及 C01 新短反馈角色与原 wash/安全边距 |

`git diff --check` 已通过。

## 验证中发现并处理的事项

- 原专属 SDK fixture 仅抽取旧成员，新增 `@Watch` 或公共 PageState 后先报“方法未登记/组件语法”；已接入真实新成员、实际公共组件和原 SDK property runtime，未用空组件绕过恢复动作矩阵。
- 原排版测试硬锁 25 节点/14 元组且缓存测试要求持久正文、不发 Toast，与已批准范围冲突。保留原始 `source-tools-typography-baseline.json`，新增 `source-tools-message-style-successor-20261019.json`，同时继续验证正常控件原元组、回调与 AUTO。
- 消费者验证发现移除来源旧 statusBanner 会一并隐藏导入后“重新搜索”；已以原 generation 恢复原只读入口，并通过旧回调失效矩阵。
- 新测试保留了取消、重复点击、错误 generation、未知回执不重复写、retired Runtime 与导航失效等反向验证。

本记录不把 SDK 的节点/事件证据称为 Ace 实际排版、动效时序、设备验证或用户接受。

## 架构门禁后继适配

追加两项 tools 门禁适配，生产源码保持冻结：

- `test-reader-page-header-contract.mjs`：通过。静默待处理浮层的负对照改为实际 Top/zIndex220 目标，仍拒绝满屏高度、输入遮罩和丢失路由准入。目录新根 overlay 精确核对 `directoryOverlay → recoveryContent/ReaderDirectoryRecoverySurface` 与保留的 `offlineBookMenu`；删除消息、插入未登记 Builder、替换原书签回调、遮罩及挤压正文均被拒绝。
- `test-architecture-shared-producers.mjs`：整套通过。新增受限 `architecture-message-producers-successor-20261019.json`，固定 SHA 并绑定批准 scope；保留 21 个原 producer，新增且仅新增 `ReaderPageState` 一个 producer，锁定全部 27 个真实调用的完整输入、原回调和有限宿主放置。新增字体/圆角/背景覆盖及错误 generation 反向验证。
- 原 93 个业务预算与 7 个可逆迁移继续完整覆盖历史 100 项，未提高原预算。原 `architecture-shared-producers.json`、`reader-full-directory-page-layout-successor-20261014.json` 未修改；新目录消息后继只转移原恢复区宽度到顶部浮层，并取消原嵌页提醒对正文高度的扣减。
- 公共 Notice/Action 的新接口、SurfaceSpecs 的批准值、C01 短提示的角色与配色由精确新后继锁定；原输入校验、原操作身份与代际断言保留。共享 AST/缓存的路径、完整源码与失败不缓存负对照继续通过。

## 最终事件与忙态收口

- SourceTools 用本次 statusEvent 区分批量结果、普通状态和操作反馈；completed/stopped 历史检测结果不再吞后续保存、确认后读回失败或导出 Toast，原批量结果保留。
- 无 receipt 的再次读取失败发布本次安全短反馈；保留旧列表/选择，无可用列表仍用页面失败态。真实 Gateway→SDK 刷新动作回归验证一次只读、无写入、去重及空态。
- SourceManagement 的未知结果核对用实际 loading 发布状态传递 Notice.busy；静止且不可核对不冒充忙态。原字号/载体不变。
- 上述 source-message-feedback、source-check-progress、source-tools-receipt-consumers、source-tools-original-recovery-sdk、source-index-presentation-consumers、source-product-tools 均通过。
- 字体旧检查保留不可变历史 fixture，通过有限消息后继和真实 SDK 父子接线验证；bounded-typography-carriers、typography-carrier-successors、conventional-typography、conventional-typography-sdk、reader-dynamic-chrome-typography 全通过。

本记录是源码及主机/SDK证据；HAP、安装和原生验收另记。

## 完整 703 项之后的定向旧检查收口

本次完整 run 的历史失败保留在 `/var/folders/53/6tc2ktbd19dbwxd5pmbp0d_w0000gn/T/reader-contract-run-yb7R5L/`，总日志为 `/tmp/reader-message-full-pipeline-20261019.log`。下列为退出该 run 后的定向重跑结果，全部退出码为 0；不能用定向结果代替下一次完整 run、HAP 或原生验收。
原生默认控件替代专项的最终重跑原始输出另存 `/tmp/reader-message-native-default-targeted-20261019.log`（退出码 0）。

| 定向检查 | 结果与当前实际契约 |
| --- | --- |
| `test-local-configuration-reset.mjs` | PASS；补齐真实 pending/Toast 方法，保留恢复范围、Preferences 故障点、身份与旧确认动作断言。 |
| `test-management-receipt-consumers.mjs` | PASS；发现书架管理普通已确认读回失败缺当前页纯读入口，由主任务补回 `statusCard` 的文字刷新动作；实际 SDK 证明双击仅一次读取、不重写，未知结果走原事项浮层，首次失败走 PageState。 |
| `test-native-default-control-contracts.mjs` | PASS；原 13 类 immutable fixture 不改。9 个原生 actor 保留；5 个旧失败页按钮精确映射至批准的消息动作。锁定 6 条当前声明、原条件/ForEach scope/代次/回调，并运行真实 owner→共享 child→13/20/500、44vp Stack；原 scope 和失效 generation 反例保留。 |
| `test-reader-cutout-setting-reflow.mjs` | PASS；普通保存期间静默；确认失败后保留设置事项。原 before/after flush、窗口拒绝回滚、阅读锚点、相同快照重试、晚回调及 Runtime 断言保留。 |
| `test-reader-directory-typography.mjs` / `test-reader-static-chrome-typography.mjs` | PASS；共享 SDK 按真实输入分别锁定 0/1 个消息 carrier 与 0/1 个正文传播点；原正常字体和 AUTO 比较保留。 |
| `test-rss-index-operation-consumers.mjs` / `test-rss-management-owner-closure.mjs` / `test-rss-management-typography.mjs` | PASS；使用真实 Notice 全部默认成员和实际 Stack 动作。A14 公用恢复动作采用批准的 13/20/500、44vp，其余 RSS 的 11/10 等正常元组保持；不恢复关闭模块入口。 |
| `test-rules-index-presentation-consumers.mjs` | PASS；仅将旧 Text36 查找转为真实共享 Stack，保留实际 Core/原操作、纯读恢复、旧 opening 与回调断言；不恢复规则入口。 |
| `test-settings-cache-index-sdk.mjs` / `test-settings-return-navigation-chain.mjs` / `test-settings-selection-owner.mjs` | PASS；真实 pendingFeedback 与 Notice 内 28vp 动作、当前/旧页面、无盲重放、选择数据与 15 组实际 Overlay/Choice 交互均保留。 |
| `test-source-cold-index-consumers.mjs` / `test-source-settings-receipt-consumers.mjs` | PASS；读取实际 Span 消息与 Stack 动作，采用当前核对/继续标签，保留冷 Core/AtomicFile、scope/operationId、一次读不重写、旧回调与用户数据断言。 |
| `test-source-switch-completion-visual.mjs` / `test-source-switch-typography.mjs` | PASS；C01 精确绑定新有限消息后继的 MESSAGE_META 12/18/400；旧 novel toast 设计元组原件、普通候选和所有未改角色继续验证；原就绪/2200ms/取消身份链保持。 |
| `test-typography-carrier-successors.mjs` | PASS；补齐当前显式忙态事实输入，继续真实父组件→Notice/Span→Action 回调与精确断边、缺 import、私有字号、AUTO 反例。 |

另单独重跑 `test-conventional-typography-sdk.mjs`：PASS，228 个契约 × 3 状态，**全量仍严格锁定 14 个消息 carrier 和 9 个 MESSAGE_BODY 传播点**，其余普通角色不受影响。受限子 fixture 没有套用全量计数，也没有目录豁免。

`git diff --check` 通过；原 native-default、recovery-successor、conventional、RSS、directory、static-chrome 字体 fixture 均通过 `git diff --exit-code`，未重写旧证据。书架管理新增只读动作未新增 native Text/字体 carrier，现有批准字体契约仍精确通过（11 个 carrier），不需要更新字体快照。本分工没有修改生产代码。
