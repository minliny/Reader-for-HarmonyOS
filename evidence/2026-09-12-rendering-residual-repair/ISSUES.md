# 遗留渲染问题续修记录

2026-09-12，按用户要求先代码定位。源码身份见 before-source.json，保留共享 dirty 工作；未操作 VM/真机。

| 编号 | 现象和触发条件 | 当前调用链定位 | 状态与未决点 |
|---|---|---|---|
| R01 | 目录/书签在首个定位回调执行前切换，新列表可能没有定位 | openList 更新 placement ticket，但 queuePosition 只判断 positionQueued；旧回调按旧 ticket 拒绝后没有为新 ticket 排队 | 代码已定位，待本地回归复现后修复 |
| R02 | 动效回到可交互端点后，数据刷新可能恢复过期目录锚点 | onInputChanged 清 leadingRow 却留下 leadingKey，refreshData 会按旧 key 再生成 leadingRow | 代码已定位，待生产方法回归 |
| R03 | 销毁待处理且新 Surface 已入队时，高亮接受记录可能保留丢弃的数据 | AttachSurface 先推进 serial，SetDynamicHighlights 记录该 serial；detach 分支丢 pendingHighlights，但不清 acceptedHighlights；新 Surface 同内容被去重 | 代码已定位；需用阻塞上传控制交错并验证重新投递 |
| R04 | Native 旧 Surface 回执已入 JS 队列，重建后才到达；旧失败可能误禁用新 Surface | Host 只在入队前检查 serial，EventPayload 未携带 serial，CallJsEvent 无交付时检查；替换 callback 也无旧队列失效门禁 | 代码已定位；需携带原始 epoch 到交付边界，补迟到/订阅替换回归 |
| R05 | 新 Surface 就绪时旧事务仍活跃，或进度已晋升后 Native 丢失，可能一直等待旧 Native 槽提交 | SURFACE_READY 无条件恢复 capability；failBookTurnRuntime 在写入开始后直接返回，已晋升但等待 Native 交接的分支也无法结束 | 集成复核定位；R04 的过期回执门禁使 READY 自身也必须负责失效旧事务。待验证“未写回滚／写入中保留／已晋升直接完成”三种恢复路径 |

保留 C01/C03/C07 的布局与滤镜成本未分离、N08 实际显示 fence、原 52 项 VM/像素/输入和性能缺口。以上代码缺陷不能直接归因到历史每一次闪烁或长帧。

- 修复前本地回归：目录新增场景复现 R01/R02；真实 Native Host 243 项中 1 项失败，复现 R03；生产 CallJsEvent 在边界 mock 下 22 项中 12 项失败，包含所有 9 类旧 epoch 事件及订阅/Host 失效场景。失败原文见 *-before.log。
- 修复中事件探针一次编译失败，定位为新增 CallbackBridge 前置声明使探针按短签名提取到错误结构；不是应用 C++ 编译失败。改用完整定义签名，保留 events-after.log 并另记复验输出。

- R01/R02 已修复：目录排队按 placement ticket 区分所有者，过期回调不能清掉新请求；结束动效时同时释放 leadingRow/leadingKey。目录生产开页/刷新/帧回调链复验通过。
- R03 已修复：销毁分支丢弃 pendingHighlights 时同时失效 acceptedHighlights；受控上传阻塞、销毁、新建及同内容重发用例通过，真实 Host 呈现用例 245 项、0 失败。
- R04 已修复：Host 回执携带产生时的原始 Surface epoch；JS 交付前重查 epoch、Host 和订阅存活状态。替换订阅先令旧订阅失效，旧 JS 队列无法复活。生产 CallJsEvent 22 项、0 失败；Host 另验证旧 SURFACE_LOST 和新 SURFACE_READY 各自携带正确 epoch。
- 既有页面高亮计数、仿真模式切换/恢复、翻页收尾、未知保存结果对账回归通过。保留显示 fence 和设备像素验证缺口，不将交付检查称为实际送显确认。

- R05 修复前在实际 LRE 事件/结束方法中复现未写事务未回滚、未知写入时过早恢复 Native，以及已晋升事务无法完成。修复中拒绝写入回滚场景又发现恢复调用放在通用重置而非回滚完成方法，生产链回归失败；已改到回滚/成功两个实际出口并复验。7 个场景全部通过，失败保留 surface-recovery-before.log / surface-recovery-after.log。
- R05 现在让新 Surface 的 READY 收敛旧事务：未写回滚；写入中使用静态回退等待权威结果；已晋升直接结束旧 Native 等待；仅在旧事务释放且新 Surface 仍有效时恢复仿真能力并重新准备纹理。后来的新失败会取消待恢复标志。
- 第一轮正式构建 186 组检查、ArkTS/Native、签名及源集合通过（b4c66d95），但它发生在补充 R05 之前，不作为最终修复包。将因 R05 的新增源码和回归执行第二轮正式构建。
- 环境只读目标枚举 5 秒超时后停止，没有重试或应用操作；进程查询受沙箱限制，改用流水线日志判断进展，没有升级进程权限。
- 第二轮正式构建 a1d93f93 纳入 R01～R05，187 组检查、ArkTS/Native 与签名通过；独立 package verify PASS。16:53:33 UTC 全输入复核 526/229/15 个文件指纹相等。设备应用操作及新运行验收均未执行，原缺口保留。
