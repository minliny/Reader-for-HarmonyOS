# 书架续读首屏：代码定位、最小修复与边界

2026-09-15，根任务给定基线 Harmony 153219bd / Core 2e5、手机13fa3794。本次未操作设备，没有本次手机原日志；工作树另有根任务刷新串行及UI状态修复，按实际文件SHA区分，不能用本地受控时延宣称真机已流畅。

## 确认的根因

1. Index.openRemoteBookDetail 先不携位置调用 probeRemoteContentVerdict → chapter.content，正文保存为prepared；LRE.loadInitialChapter再次读取权威进度，openChapter把双版本与restored锚点组成positionContext。ReadingSessionFlowGateway原实现只要positionContext存在就无条件拒绝prepared，即完全相同版本和锚点也二次chapter.content及物化。真实生产网关修复前探针保留在 `/private/tmp/shelf-prepared-before.mjs`、`/private/tmp/shelf-prepared-before.json`，含3个文件SHA：无context零请求且返回原prepared对象，有context一次额外chapter.content且不同对象。这是缺陷复现通过，不是性能验收。
2. 目录/书签投影不是显式await首屏：原Index确实使用void。问题在于它仍立即派发 cache.book.status → 全目录下载状态/图片清单 → bookmark.list，与首屏必要的进度/正文争队列和物化资源。不能误报成“目录全部加载完才允许openReading”的串行门槛。
3. 会话缓存不是完全不生效：Coordinator.acquireBook在源版本相同、24小时缓存窗口内复用prepared session，避免重新detail/TOC；Index也保留同书现有session并经canonical evidence继承prepared。真正断点是带位置的正文交接、额外投影派发。源/目录/上下文版本变更仍须拒绝复用。

## 已实施的最小修复

- Index仅书架resume先读Core当前progress；按Core实际章而非可能过时的ShelfBook.currentChapterIndex选择探针。只有进度双版本齐全才携带 `{ bodyVersion, processingVersion, anchors:[{id:'restored',offset}] }`；无进度可用探针确认的首章，旧无版本进度保留旧位置语义。
- 首次chapter.content携带上述context；probe在任何await前复制并验证context，prepared再次保存值快照。ReadingExperience仍独立loadProgress作为最终权威，不增加Host进度缓存。
- ReadingSessionFlowGateway复用同时要求：同session/章URL、source版本、projection revision、未强刷/未消费，以及已送Core验证的context与现在context逐字段/逐锚点完全相同，且body/processing版本与正文一致。无验证context、进度偏移/锚点ID/双版本变化、迁移后版本不一致均回Core，禁止仅凭正文非空放行。保留根任务新增force串行尾部。
- Index缓存刷新提示使用ownerCurrent（导航+probe generation+session）继续恢复；普通probe仍加projection revision。这样用户确认刷新主动改变revision不会取消自己，其他导航/会话仍会取消。
- 书架resume的下载/书签补充投影存为一次待派发任务，在presentPreparedReading收到已提交首屏回调后启动；详情预览保持原即时补充。派发/回包复核session、书名作者与离线generation。期间书签变更时保留当前书签，只合并仍有效下载状态；退出/串书/目录变更不提交迟到结果。这里的“首屏后”是已提交页面的回调边界，不是新测量的compositor时间。

## 本地验证

新增 `tools/test-shelf-resume-handoff.mjs` 通过实际Index.openRemoteBookDetail/openReading/probe、实际LRE.loadInitialChapter/openChapter及真实ReadingSessionFlowGateway/RemoteReadingFlowGateway，控制Core回包和布局边界：

- 相同进度：两次权威progress读取、一次正文读取；旧架上第0章被Core第1章纠正。
- 两次progress之间偏移变化：第二次正文重新验证，不能用旧prepared忽略新偏移。
- 无进度、旧无版本进度均保持原语义；版本/锚点ID/offset/数量变化与未验证scope不复用；context为不可变快照，非法偏移拒绝。
- 首屏提交前没有cache.book.status/bookmark.list；提交后仅一次派发，下载标记正常归并；途中新增书签不会被旧投影清空。
- 导航/会话取消不派正文；刷新主动修改projection revision后ownerCurrent仍有效。

另11个相关入口最终通过：remote-reading-evidence、remote-position-migration、bookshelf-reading-entry、search-candidate-acquisition（37组）、search-trial-reading-return、demo-async-recovery、remote-position-reader、remote-reading-flow-runtime、navigation-performance、performance-regressions、search-detail-cache-first。旧提取测试仅补真实helper依赖与progress回包；首轮fixture加载/注入失败及最终日志留在 `/private/tmp/shelf-resume-regressions/`。上述是12个测试入口的本地证据，不是12种真机性能指标。

## 仍须保留的边界

没有重新编译HAP、安装或读取手机日志。由根任务统一完整Harmony/Native/HAP门禁。真实冷/热书架点击→已呈现正文时间、队列耗时及连续UI帧率仍需对应产物的实际证据。目录Core扫描优化、刷新事务/失败恢复、详情闪烁由其他owner提交，不能把本切片单独声称完整性能闭环。
