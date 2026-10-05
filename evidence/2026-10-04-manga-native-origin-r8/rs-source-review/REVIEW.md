# R8 RenderService 数字 dump 官方源码审查

2026-10-04；只读官方上游源码研究。没有 HDC/VM/截图/漫画源图片/缓存/数据库操作，没有运行采样、测试或构建，没有产品修改。仅保存本报告与出处小型元数据；未复制上游仓库或完整源文件。

**结论：现有已查官方数字 dump 不能严格证明 Reader 某个漫画 Image 的绘制目标矩形已经提交并由 compositor 实际送显，`submittedPaint` 必须保持 OPEN。** 可查 RS 属性/几何状态，不能用属性树、帧计数、客户端节点回传或 `forceDumpSingleFrame` 名称代替绘制/送显证据。Root 没有后续 VM 操作计划，本研究到此结束。

## 版本与出处边界

最终结论以官方 `openharmony/graphic_graphic_2d` 的 `OpenHarmony-6.1-Release` 固定提交 `71200d49198db3ba28e246b456cac04c758dda10` 为代码基准，各文件 URL/字节数/SHA-256 见 [SOURCES.json](SOURCES.json)。同时只读参考 master `3afbed23db3daf75607cd890e76a4755947fec53` 和官方 docs/master。没有用任何第三方文章推定命令或字段。

当前任务所记录 VM OS6.1/API23 是既有设备记录。名字相同不证明该 VM 的商业系统分支、编译宏、RenderService 二进制、dump 权限及命令分发表与 OpenHarmony 6.1 Release 或 master 完全一致。本审查没有重新查询 VM help/版本，未证明任何候选命令在该 VM 可执行。

## 命令和输出范围

下表是静态代码候选语义，**不是已执行命令，也不构成安排设备操作**。命令容器示意为官方 hidumper 的 `-s RenderService -a "<option>"`；不使用 allInfo、dumpMem、heap、SKP、pixel、buffer、profiler recording。

| Option | 官方 6.1 实现范围 | 输出/限制 |
|---|---|---|
| `h` | 命令帮助 | 可见该二进制的分发表；本轮未在 VM 查询 |
| `surfacenode <RS surface id>` | 单个 RSSurfaceRenderNode | ID、Name、SrcRect、DstRect、CornerRadius、Bounds(width,height)、ContextClipRegion、Zorder、IsOnTheTree、Visible、OcclusionBg、Alpha/contextAlpha、GlobalAlpha、visible region；末尾还调用 consumer->Dump，因此原生输出不是纯数字白名单，也没有已查 byte budget |
| `RSTree` | 从 global root 遍历所有 RS 节点，再到 uni-render drawable tree | handler 不使用附加 PID 或 node 参数；加 PID 不会限制成 Reader-only。MAX_DUMP_DEPTH256 只是深度门限，不是节点数量/字节预算 |
| `client` | 服务收集所有相关 app 的客户端 UI node tree | handler 不使用附加 PID；服务按已知 topNodes/PID/token 分组后给各 client 发命令，再异步收集。不是 Reader-only，也不是已经送到 compositor 的 image draw command dump |
| `MultiRSTrees` | 读取/清空先前累计的 g_dumpStr | 历史树汇总；不能与当前一个 Image receipt 或一帧自然绑定 |
| `dumpNode` | 在本次最终 6.1 command map 无此命令 | 不能从 docs 示例发明 PID/节点参数。未知命令走帮助 fallback，不等于收到目标节点记录 |

命令表出自 [rs_dump_manager.h:77–116](https://github.com/openharmony/graphic_graphic_2d/blob/71200d49198db3ba28e246b456cac04c758dda10/rosen/modules/render_service_base/include/gfx/dump/rs_dump_manager.h#L77)。[rs_dump_manager.cpp:94–112](https://github.com/openharmony/graphic_graphic_2d/blob/71200d49198db3ba28e246b456cac04c758dda10/rosen/modules/render_service_base/src/gfx/dump/rs_dump_manager.cpp#L94) 遍历 unordered_set，匹配一个命令并 break；不存在输出则给帮助。不能混入多个 command 期待有序执行。6.1 `surfacenode` 去除命令后从余下集合拿一个值以 atoll 解析；只许一个已知 RS surface ID 才有确定参数语义。

具体 handler 为 [RSRenderService::RegisterTreeFuncs:816–854](https://github.com/openharmony/graphic_graphic_2d/blob/71200d49198db3ba28e246b456cac04c758dda10/rosen/modules/render_service/main/render_server/rs_render_service.cpp#L816)。[RSRenderService::Dump:316–332](https://github.com/openharmony/graphic_graphic_2d/blob/71200d49198db3ba28e246b456cac04c758dda10/rosen/modules/render_service/main/render_server/rs_render_service.cpp#L316) 将全部结果拼成字符串写 fd，没有本次已查的单节点数量/字节截断参数。主干也同样没有 `dumpNode` 分发表；官方 [docs/master hidumper 文档](https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/dfx/hidumper.md) 的 RenderService 示例仍列它，属于文档与本次代码基准不一致。不能据此判断当前 VM 是否另有 vendor 实现。

## Bounds / matrix / frame 字段是什么

[RSProperties::Dump:4532–5066](https://github.com/openharmony/graphic_graphic_2d/blob/71200d49198db3ba28e246b456cac04c758dda10/rosen/modules/render_service_base/src/property/rs_properties.cpp#L4532) 打印 Bounds(x,y,w,h)、Frame(x,y,w,h)，小数格式为一位；再按非默认值输出 clip、pivot、rotation、translate、scale 等变换/装饰分量。此函数没有导出完整绝对合成矩阵，也没有逐个 DrawImage 的 src/dst、clip-chain 或 present-fence 回执。`Frame` 在这里是几何矩形，不是 frame sequence。BgImage 矩形是节点的背景图属性，不能冒充漫画 Image 绘制命令的 destination。

[RSRenderNode::DumpTree:1088–1167](https://github.com/openharmony/graphic_graphic_2d/blob/71200d49198db3ba28e246b456cac04c758dda10/rosen/modules/render_service_base/src/pipeline/rs_render_node.cpp#L1088) 输出 RS uint64 NodeId、instanceRootNodeId、节点类型、Properties、UIContextToken，surface 还有 buffer/visible region 属性。PrepareSeq、PostPrepareSeq、VsyncId、IsSubTreeSkipped 等仅在 `GetDumpRsTreeDetailEnabled()` 为 true 时输出；本轮没有打开这个全局参数，也没有证明 VM 默认配置。

主干 [rs_common_def.h:752–767](https://github.com/openharmony/graphic_graphic_2d/blob/3afbed23db3daf75607cd890e76a4755947fec53/rosen/modules/render_service_base/include/common/rs_common_def.h#L752) 明确 RS ID 中 PID 编码为高32位；这里只记录该主干源码事实，未证明 VM 二进制编码。它只支持已获得且已核版本的 RS ID 与进程关联，不支持从 UITest Image id/hashcode 猜 RS ID。ArkUI UINode/AccessibilityId/inspectorId→RS ID 的显式桥由并行独立 ace_engine 审查记录，本报告不重复，也不声称本机已经取得该桥。

`surfacenode` 获取的是 RSSurfaceRenderNode 的 SurfaceBuffer 级 SrcRect/DstRect。即使节点是 Reader 的窗口，也只证明窗口 Surface 的这些服务属性，不能把它等同于某个 child Canvas/Image 的图片 destination、最终遮挡关系或屏幕像素来源。底部 indicator/全窗口 surface 大小也不能补齐该证据链。

## forceDumpSingleFrame 没有提供提交或送显证明

[RSMainThread::RenderServiceTreeDump:3801–3846](https://github.com/openharmony/graphic_graphic_2d/blob/71200d49198db3ba28e246b456cac04c758dda10/rosen/modules/render_service/core/pipeline/main_thread/rs_main_thread.cpp#L3801) 的 true 分支打印 transactionFlags、timestamp_、vsyncId_、animating node IDs、cached transaction map，调用 global root DumpTree，再调用 uni-render thread 的树 dump。false 分支输出并清空 g_dumpStr。true 分支没有逐 Image draw command 完成回执、GPU/compositor present fence，也没有为每条客户端 tree 数据附同一个提交 transaction 与 display presentation ID。

[RSUniRenderThread::RenderServiceTreeDump:1151–1168](https://github.com/openharmony/graphic_graphic_2d/blob/71200d49198db3ba28e246b456cac04c758dda10/rosen/modules/render_service/core/pipeline/render_thread/rs_uni_render_thread.cpp#L1151) 在渲染线程运行/同步调度 DumpDrawableTree。它得到的是 drawable 状态树；代码没有由本次 dump 执行 Draw/Present 并返回显示 fence。服务主线程状态和随后取到的 drawable tree 也不是本次已证明的单一 compositor 帧原子快照。

这里的 timestamp/vsyncId 是已有 RS 成员状态，不是 "此 Image 已送显" 的回执。可用于描述服务状态的时间/序号，不能把客户端 onComplete、节点存在、IsOnTheTree/Visible、PrepareSeq 或这一名称合并成提交/绘制 PASS。客户端树另由 [SendClientDumpNodeTreeCommands / CollectClientNodeTreeResult:3849–3940](https://github.com/openharmony/graphic_graphic_2d/blob/71200d49198db3ba28e246b456cac04c758dda10/rosen/modules/render_service/core/pipeline/main_thread/rs_main_thread.cpp#L3849) 异步收集；客户端参数/桥信息也不能自行变成服务送显证明。

## 最小可用范围与结束条件

可保留现有生产 Image.onComplete 数值事件、Area 与同 owner UI tree 的各自证据范围；不要把 retained receipt 的 OPEN 改为 PASS。本研究没有找到无需新框架、无需全系统收集、无需录制/图像数据就同时满足 Reader PID + exact current Image actor + drawImage dst + 同一提交/送显帧的严格 bounded numeric 系统接口。

若后续有人在另次授权范围证实当前 VM 有 vendor 的定向节点命令，仍需要真实 help、参数范围、输出白名单、进程/actor桥、transaction/frame 的来源和语义，不能套用本次 master/6.1 内容。这只是保留验证条件，不是本轮建议继续操作 VM。

本轮结论：官方源码能力研究完成；节点属性/客户端桥潜在可用，**current VM 支持及 compositor submittedPaint/presentation 证明仍 OPEN**。没有性能/trace/profiler 扩展，没有后续采样。
