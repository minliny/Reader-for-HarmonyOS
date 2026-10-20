# 搜索入架与书架长按操作失效（2026-10-14）

用户反馈：搜索结果无法加入书架；已在书架的书籍长按弹出框所有操作按钮无效。搜索入口具体位于结果列表还是详情页，以及取消/遮罩关闭是否也失效，已请求澄清；不以缺失答案阻止代码侧审计。

最近交付为 iteration `20261013T152937Z-493e6315-cb60b341`，signed SHA256 `177639dbd662d1f632f7d72ddc440ce1042a8fcce238b637ca4eaabfc8b0bb91`；真机安装/启动回执 `deploy-physical-b1f20b88963d-20261013T161039Z.json` 通过。此记录只绑定最近交付，不把现场当前 UI 与包身份核对视为已完成。Harmony/Core 工作树有大量并行未提交修改，保留无关修改及全部用户数据。

先审计 SearchPage/LocalBookDetail → Index 入架回调 → BookshelfReadableAdmission/Host 写入；以及 BookshelfPage 长按 → BookshelfBookActionSheet → Index 操作回调的捕获身份、状态、路由/挂载生命周期和命中边界。复用实际 SDK 回调与生产方法探针，先定位再修复回归。未安排设备交互、未清理缓存或数据、未提交。

当前结论：新交互回归，根因待定位；上次全量合同 675 PASS 不证明这两个实际操作通过。代码定位、回归、构建签名、设备交互及用户验收分别记账。

用户已澄清：从搜索进入详情后点击「加入书架」无响应；长按框取消/空白关闭也失效。

代码侧真实 SDK 复现：BookshelfPage 的 `@State actionBook` 为 ObservedObject 代理，`bookActionSheetPresentation` 实参被 SDK 自动 GetRawObject，引用相等守卫对四个操作全部返回 false；dismiss 的引用比较也使关闭不生效。原测试没有实际 State 字段，假通过。修复改用弹窗 token、导航/挂载边界与 sourceId/bookId 身份，保留当前书架实体核验。新的实际 bindSheet/State/Prop SDK 回归和旧引用比较负对照覆盖四按钮、关闭、重新打开及旧回调。

详情入架确定缺口：正常小说详情元数据已显示时按钮 enabled，但 `remoteReadingSession` 尚未就绪，addDetailBook 静默返回；真实父/子 SDK 按钮调用后零 admission、零消息。修复不再把 UI session 作为入架前提，从同一当前详情构建既有 metadata 交给现有可读性准备 owner；已存在 session 时继续 exact source/book 校验并优先已准入元数据。准备流程立即显示进行中、加载目录/正文后才入架，保留取消及旧 scope 护栏；原入架/移除 guard 的 busy 同步纳入 UI enabled。

同类分组缺口：`openShelfGroup(rawBook)` 写入 `@State editingShelfGroupBook` 后，Host 绑定 current 对 raw/proxy 做引用比较而被拒绝，选项和遮罩失效。两处 Index 守卫改为已有 shelfBookKey 身份核验，保留 presentation/nav/runtime/mount/Host。searchDetailCandidates 与漫画 selection 是普通字段，未机械修改。

冷漫画入架补齐：Core BookshelfAddParams/reading.preparation.pendingAdd 为 deny_unknown_fields，禁止添加 contentKind 破坏现有 wire。Coordinator 在 ensureSources 和阅读类别校验后，从当前 comic registry 为缺省媒体 hint 的 seed 补漫画类型，使用已有目录与首图验证路径；未改 Core/协议或绕过首图/CAS。

定向验证全部通过：长按 native sheet 真 State/Prop 与实际注册 Builder 回归（四按钮、关闭、重开、行更新、旧回调、原守卫负对照）；详情入架真实父 Builder/子 Text/实际门禁/Owner/Coordinator（无 session 即显示 preparing、正文或漫画首图成功前不写、错误会话拒绝、busy/unknown/reading/switch/offline 一致、失败可取消、旧 scope 迟到、严格 wire）；分组真实 State 回归18项、shared management/Core20项和 JSON dialog 依赖。另6组 Coordinator、漫画准入、详情稳定性/移除、搜索操作 owner/身份与相关 Sheet/列表合同通过。只读复核通过，取消仍限定同书 reason=add 与 revision，现有正文/首图、未知写入及事务护栏未削弱。

DevEco 当前同一工程 assembleHap/ArkTS/指定证书 signer hook 通过（7.801s），开发输出 signed SHA256 `c83dac463ee56a2ed63f2b8481f40a8688ae021fa0b637d1ca76f9616a2537d5`。此输出为 IDE 开发同步；正式交付继续使用重新执行完整门禁的 canonical 不可变包，未使用旧包或共享输出替代。

生产、测试和文档已冻结，重新执行完整675门禁；后续构建、安装/启动、两项设备交互及用户验收分别记账。

首轮全量运行中，应用新增回归通过；`test-contract-test-tiers` 的 scopeClean 子进程夹具失败：250ms 到期时并行负载下 child 尚未完成 SIGTERM handler 初始化（或未在100ms grace内处理），实际 status=null，期望退出0。这是测试夹具对初始化耗时的脆弱假设。保存原始失败及当轮部分合同输出，验证自有 pipeline stdout/进程树后 TERM（exit143），未发布 HAP、不复用部分 PASS。仅修该测试的有限启动/grace夹具假设及 readiness 核验，正式 runner、110s deadline、超时必须失败、unrun 和真实退出断言保持不变，再重新执行完整675。

夹具修正完成：scopeClean/scopeIgnore fixture 使用2s scope、4s child deadline（确保 scope 先到期）及有限1s TERM grace；child 注册 handler 后写 ready，收到 TERM 写同一PID标记，要求ready/term PID一致。clean status0/signal=null/仅TERM、ignore SIGKILL、scopeExpired/超时必须失败、unrun及所有active settlement等原矩阵继续断言。定向与4进程真实SDK/管理Core并行负载复核全部通过，生产 runner 与正式110s限制未改。所有输入再次冻结，开始新的完整675，不复用中止轮。
