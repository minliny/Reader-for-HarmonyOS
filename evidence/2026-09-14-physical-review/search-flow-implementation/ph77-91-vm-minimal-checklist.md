# PH77–91 最小 VM 检查入口

本清单来自当前源码只读核对，尚未执行设备操作。目标、HAP manifest、共享锁及系统就绪由部署 owner 按既有门禁确认；这里不复用旧 VM 端口。下列“无写入”仅指检查动作不新增或修改用户书籍、进度及配置，不代表应用启动恢复流程完全没有存储操作。

## 可直接执行且不依赖真实书源

1. **搜索入口、历史与光标（PH80–82）**：普通书架页点击搜索；确认输入法自动出现、竖直插入光标可辨。输入短文本但不提交，退出后重新进入。已有历史全部直接显示并可滚动，无“展开”入口；历史不足时只检查实际数量，不创建历史凑样本。源码：`Index.ets:2331`，`SearchPage.ets`，`ReaderSearchField.ets`。
2. **目录预览与外部目录（PH83–84）**：若已有至少 20 章的本地书，长按书架书籍→“书籍信息”；在四行高的预览视窗内滚动至第 20 章→“完整目录”→返回。确认外部目录返回原详情，没有提前打开正文或阅读控制栏。只滚动，不点章、书签、下载或清理。没有合适本地书时保留待验，不导入新书。源码：`BookshelfBookActionSheet.ets:55`，`LocalBookDetail.ets:46/327/538`，`Index.ets:3633/1123`。
3. **已有隔离长目录样本**：精确 debug 冷启动参数 `readerControlMotionVerification=true`（primitive boolean），进入“打开初始快捷页”→“目录 / 书签”→展开、连续滚动首尾、切换书签、收起/返回。样本为 **60 章、2 个书签，当前章 index 20**，不接生产读写业务。可观察原生目录列表与控制栏布局/返回，但不能替代 PH77–79 或 PH90 内容搜索性能验收。源码：`ReaderControlMotionVerification.ets:22/135/145`；已有 `tools/reader-control-device-probe.mjs` 支持这一冷启动入口。

两个 debug 参数不可同时传，暖启动不会切换诊断页面。`readerOpenSourcePilot=true` 实际进入 **ReaderRendererPilot**：隔离 WebView 原创正文、翻页/字号/临时位置及 PH76 内存资源验证。该页面**没有内容搜索、没有 2000 行搜索 fixture**；motion verification 页也没有。它的亮度与导航是占位样式，不能验 PH88。源码：`ReaderControlVerificationLaunch.ts:13`，`EntryAbility.ets:24`，`ReaderRendererPilot.ets`。

## 仅在已有阅读会话或获授权隔离测试书上执行

4. **内容搜索与更多菜单（PH87、PH90–91）**：在已打开的阅读会话唤出控制栏→“搜索”→展开完整态；先不提交，只检查空输入页打开、输入法、输入与返回响应，以及输入框内无重复搜索图标。再收起/重开，确认不会被迟到焦点抢回。返回控制栏→“更多”，核对“书籍信息 / 刷新本章 / 下载全部章节”、右侧锚点、指向箭头与文字容纳；只开关菜单，不点刷新/下载。本地书下载应禁用。源码：`ReaderControlPanel.ets:1275/1507/1544`，`ReaderControlSearchContent.ets:380/417`。
5. **长结果恢复（PH77–79、PH90）**：当前没有满足“无真实来源、无用户数据写入”的 VM fixture。2000/10000 行只在 `tools/test-reader-content-search-native-list.mjs`，2000 行发布/40 页×50 条分别在 `test-reader-content-search-publication.mjs`、`test-reader-content-search-open-cost.mjs`。不能靠打开 SourcePilot 获得这些结果；需另行准备隔离样本后，才执行搜索→持续进度→滚动→关闭/重开→停止/失败重试→详情→返回原搜索，检查位置、进度与旧结果保留。
6. **其余实际业务/视觉边界（PH85–86、PH88–89）**：PH85 指定来源正文与旧缓存升级不能由 WebView 原创正文代替；刷新会改缓存。PH86 可在已有会话观察无书签时图标隐藏、已存在书签时填充；下拉提交会写书签。PH88 可观察亮度轨道/按钮对齐，暂不改变亮度设置。PH89 需真实自动翻页胶囊，启动后可能推进并保存进度。上述动作仅在明确获授权的测试书上执行，不能列作无写入诊断页 PASS。

本清单不包含性能达标结论。设备输入响应、原生可见范围、逐帧动效、真实来源速度与用户验收仍需对应证据。
