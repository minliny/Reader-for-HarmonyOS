# 搜索试读、入架与换源身份故障（2026-10-12）

## 搜索全空反馈重新打开（2026-10-13）

用户反馈：当前真机搜索《大明望族》的书源全部为空。触发页尚待确认（搜索页或换源重新查找），不把传输/规则/准入失败当作正常无结果，也不据过去合同通过认定真实书源正常。最新已构建的iteration为 `20261013T132056Z-493e6315-ec2c35f4`；上轮Bundle Manager更新后因锁屏启动失败，没有最终组合部署回执，用户正在使用的实际页面/产物尚未绑定。

本轮先审计搜索来源选择、请求/结果解码、错误分类、默认书源供给及换源身份护栏，使用现有生产方法回归探针。当前HDC只列出已有VM，用户物理机不在线，不能读取真机请求/书源状态，也不把VM替代为本次真机证据。已请求确认触发页并重新连接发生问题的真机；不清书源/缓存、不强制启用全部来源、不放松同书身份护栏、不自动替换到其他书籍。

用户已确认触发页为换源窗口重新查找。代码审计/生产方法探针确认：Core change.bookSource单源HTTP403/解析失败被聚合成成功空候选；Host又吞普通单源错误。普通作者「府天」和「作者：府天」正常准入；仅session缺失时合法@装饰证明可能丢失，不能全局去@或接受空作者。普通搜索另有全部健康/冷却跳过后重试不可点的恢复缺口，已独立修复并定向通过，不将它当作本次换源现场根因。

物理机重新连接后，最小取证限当前换源窗口状态/当前书名作者，以及Reader进程已有日志中的HTTP/规则/域名错误类别。代码无法证明这次实际属于哪类失败，也无法读取不存在的session证明；需绑定实际窗口事实后再认定。不开新搜索、不选择候选、不改当前书籍、来源、进度或缓存；不读取Core数据库或重试之前权限拒绝路径。

用户保持换源页面后，2026-10-13 22:14 的只读 ArkUI 布局明确显示：当前书籍《大明望族》、作者 `@雁九`、来源「爱推书君（优）」、最新目录 `第0017页`、正在查找且候选数 0；背景正文为书友评分/评语。现有 Reader PID hilog 未留存此次请求错误，不能据此认定 HTTP/DNS 具体失败。首个截图误取到用户其他应用，未纳入证据并已删除，后续仅按用户明确保持的 Reader 页面读取。

对 bundled corpus 的三个爱推书君对象逐项检查：type=0，ruleSearch/ruleBookInfo 读取 `@{{$.author_nickname}}`，TOC 请求 `listBookScoreByBook` 并生成页码，ruleContent 的 parseComments 拼接书友、评分和评语。这是书评来源误分类为小说的确定缺口；当前严格同书名/作者准入拒绝小说候选，不允许直接把 `@雁九` 猜改为府天或以书名相同覆盖旧进度。修复在共享类别中将明确书评/信息来源排除阅读链，已有该来源的换源入口给出明确恢复提示，保留书源、书架及原进度；错误呈现与合法作者 proof 丢失为另外两条独立修复。

本地修复：换源改用 Core `book.search` 单源请求并复用生产 SearchGateway decoder，使真实 HTTP/规则失败保留为查找错误；零候选且存在失败时给安全计数和 HTTP 状态摘要，成功空结果仍为空态。作者 proof 从精确 seed/detail/session 携带，并从当前 source registry 与精确 `search-book.get` 严格读回；过期、错书、错原始作者及未启用来源不得自我授权。Host 在身份读取前订阅并暂存 dirty 发布，资格结束后缓存、发现、选择、目标核验使用统一 query；known 首帧立即发布，但点选先显示 switching，当前资格核验完成前不获取或提交。

12 条已审书评/推荐/信息语料在共享类别中归为 other；仅匹配已审 provider 标签/域名/具体路径，不按「我的书单小说」「小说推书」等个人命名或分组误杀正文来源。Coordinator 与 ReadingEntry 的 prepared、缓存及传入已验证 session 路径都应用同一准入，保留普通停用/删除书源的已验证离线阅读。

定向生产回归已通过换源 Gateway、Host 49 项、Index SDK 14 项、漫画切源/准入、事务、搜索 Gateway、书籍元数据；新增 pending registry 点选覆盖小说试读/书架 current/stale proof：立即状态反馈，过期证明零 acquisition/commit，合法证明只获取一次。源码、全量合同、HAP 和设备证据继续分开；本轮尚未在设备选择书源或保存进度。最终全量构建与保数据部署结果另记。

独立只读复核另找到新增资格阶段的退出竞态：pick 的 resolve await 后失效早返缺少清理，retire 后 snapshot 仍为 switching，open/bindReader 持续拒绝。首轮全量合同尚在运行时已停止自有 pipeline 及子任务（exit 143），未发布 HAP；先按 scope/generation 精确跟踪无写入的资格阶段，在 retire 时立即释放该阶段，迟到完成不得覆盖后继 scope。须增加 pick 等待期 retire/Runtime 退役/重开的生产负对照，再重启全量门禁；不复用中止轮的部分 PASS。

上述资格清理补丁独立只读复核通过；原生 DevEco `assembleHap` 已从同一当前工程成功构建（13.9s），使用统一私有 signer hook 完成验证，开发输出 SHA256 为 `2b21dc85f3ab49f1003dce57ac293205945b494bfbf1eacc67b3aab952f95650`。此输出仅证明 IDE 编译/签名入口及源码可构建，后续仍用 canonical 全量门禁产物部署，不从 IDE 输出代替不可变交付。

最终退出竞态回归：Host 60 项、Index SDK 16 项全通过；8 条资格取消/Runtime handoff × 迟到成功/失败场景，在旧 IO 结束前可重开，且零 acquisition/commit、不覆盖新 scope。去掉 retire 清理的负对照复现 switching 悬挂；去掉 exact-object finally guard 复现迟到隐藏新页面。真实获取/未知写入阶段的退出保护仍通过；所有编辑已冻结，重新运行完整门禁。

完整首轮结果为 673/675 PASS（442s），没有发布 HAP。两项失败分别是 navigation-performance 旧静态条件未覆盖新增 hasCurrentCatalogProjection，以及 trial-reading-return 的 SDK 方法夹具未绑定新增真实 author decoder/当前目录归属方法；该夹具也必须在资格核验后确实派发 acquisition 才能用 Deferred 注入「迟到获取失败」。已保留失败日志，精确补齐生产模块依赖、按实际派发计数等待和当前目录的对象/版本归属模型，两项定向全通过；没有取消断言或以 catch/noop 掩盖拒绝。生产源码未变，重新执行全部675项，不复用失败轮结果。

后一轮完整 675/675 门禁、非增量构建及签名已通过，发布 iteration `20261013T150029Z-493e6315-8ce71a00`（signed SHA256 `96b64e49db54df57b03edcc013e427796a8d108ded6a49ce576b5692a990aa31`），尚未安装。补查实际 SDK 漫画点击链时发现：Host 从精确 search-book.get 恢复的作者证明没有进入 Index 重建 query，导致能显示的合法候选点击被拒绝，selectionPending 悬挂；最终目标验收也再次重建未证明 query。该包不包含此补丁，不作为最终交付。

漫画修复使用点选时捕获的原精确 query，立即发布 switching，异步同一 Gateway 重新资格后将同一结果传递 preview/最终目标断言；无跨页面 detailBook 写入。目标候选启用、媒体类别、当前规则版本复用同一 source registry 快照核验，失效报可恢复错误，严格书名/作者和 Native progress CAS 继续保留。新增冷启动 get-only proof、目标变更、取消及错误回归后重新冻结并全量构建，不复用上一轮 PASS。

最终只读复核通过：手工选章持有同一 assertQualified，prepareSelected/commitPrepared 在派发前应用 qualifiedCurrent，await 后继续断言；错误使用普通页面 current 呈现，避免配置变化被当作静默取消而悬挂。原 expectedFrom/expectedTarget 双侧进度 CAS 与首图版本校验保留。Gateway 16 组目标资格回归通过；Host 64 项通过，包括可见候选被停用、删除、更新版本、改媒体后零获取/提交并可立即退出。

最终 DevEco 预编译先报告 Index 两个 catch 中 `let failure = error` 推断为 any（arkts-no-any-unknown）；改为显式 `Object` 后从同一工程重编通过（6.626s），指定 signer hook 验签成功。最终 IDE 开发 signed SHA256 为 `770d77a8b2fe5932410542aab3af812f463961ebf775aa19fc49760148734af1`。该输出不替代最终 canonical 全量门禁产物。

冻结前最后定向全部通过：Host 64、Index SDK 26（精确 Core-only 作者证明冷漫画完整点击及9条负路径）、trial-return 12、漫画换源/准入；手动目录停留、首图加载和实际 shouldCancel 提交派发三处 registry 变更均零越界提交、保留旧阅读上下文且可恢复。其余9组换源消费者和 diff 检查也通过。两处旧 SDK/related fixture 分别补真实 errorMessageOf 和 acquisition.sourceVersion，不削弱目标版本断言。生产、测试及文档冻结，重新执行完整675门禁。

## 用户反馈与版本边界

用户复现：搜索《大明望族》→详情进入阅读→跳到第 325 章→退出到详情→加入书架→返回书架→再次打开，直接跳转到第 3 章、闪烁后提示书源不可用；换源列表延迟为空；重新查找首项为“阅读助手（优+++”，切换后书籍变成《跳出轮回》。用户明确纠正这是实际章节跳转，不是章节信息显示问题。另有搜索停止按钮动态图标过小、文字偏高的反馈。

反馈来自用户实际使用；未将旧包安装记录视为本次故障的精确产物绑定。当前 HarmonyOS/Core 均有未提交并行改动。本次先完成代码审计及本地生产方法回归；未清理用户数据。

## 已定位根因

- 换源发现和 acquisition 增量发布缺少当前书名/作者准入，已有 `matchesCandidateBook` 未调用；错误搜索结果可在关系核验结束前被点击。目标详情还需再次核验书籍元数据，不能只比较 sourceId/bookId。
- 普通搜索未产生可持久化的版本绑定 searchTiming；换源强制刷新主动丢弃旧耗时。这两条分别影响首次打开与重新查找期间的显示。
- 同源目录刷新借用了换源章节匹配器，接受 `LastReadFallback` 后把新目录首个可读章节写入 durable progress。真实 `finish_toc_result` 负对照中，原目录 326 条、第 325 章（index 324）被截短目录的第 3 章（index 2）替代，offset 9 保留；随后 `reading.progress.get` 确实返回 index 2。实际跳章已定位，不是标签显示错误。
- 严格入架重建书架条目会触发同标题试读文档删除，是另一个独立问题；该稳定目录场景下 progress/history 原本保持第 325 章，不能用它单独解释实际跳章。
- 搜索停止按钮：原生 LoadingProgress 的圆环小于布局尺寸；原文字行高为字号本身，缺少垂直行距居中。

## 修复与验证

### 已完成源码与本地验证

- 换源发现、获取增量、缓存关系、点击和目标详情均校验当前书名/作者；Core 历史别名闭包不再单独授权换源。已污染关系将《跳出轮回》连入《大明望族》的回归已通过，错误项不能触发获取或提交。小说和漫画共用身份护栏。
- 普通搜索在调度实际执行时开始计时，请求返回时结束；结果立即携带版本绑定耗时，并通过最多 4 条并发的后台增补持久化。换源刷新保留已有合法耗时，实际新结果替换并重新排序；Index 首开候选复用公共 decoder。版本变化、取消、持久化失败和投影竞态均已回归。
- Core 动态负对照复现：326 章目录中试读第 325 章后入架，progress/history 不变，但该章派生文档被删除。修复后同标题入架保留已验证文档，首帧恢复 chapterIndex=324、offset=9，最近阅读时间保留。schema 37→38 的前向迁移替换旧触发器；改名仍撤销旧处理上下文。`cargo test -p reader-storage --features sqlite --lib` 301/301 通过。
- Host 隐式恢复拒绝“正文第 3 章、已保存进度第 325 章”的不一致 DTO，显式目录选章仍合法。真实解码器删除唯一新增 guard 的负对照重新接受错误 DTO，异步/同步首帧两种路径均已回归。这是防御补强，未证明 Core 在用户设备实际返回了这个组合。
- 搜索原生加载指示器绘制框改为 28vp；搜索/停止专用文字行高改为手机 20vp、宽屏 22vp，并居中分配行距。真实 SDK 手机/宽屏、搜索/停止四种状态和原点击/停用行为回归通过。
- 同源目录发布只接受旧目录或已有 detached proof 提供的章节身份，禁止用新目录的相同序号证明旧章节；拒绝顺序/首章兜底、重复身份、同 URL 不同标题以及缓存坐标改绑。拒绝保持旧目录、正文、progress offset/fraction/版本。存在正文缓存时目录重排安全拒绝，未实现正文坐标迁移；正常尾部新增放行。缓存占用使用索引 EXISTS 纳入事务快照，提交时再次比较，覆盖计划后正文到达的竞争。
- Host 对四个精确 `CATALOG_CURRENT_CHAPTER_UNRESOLVED` 原因使用可恢复目录提示，不清理缓存、不标记书源永久损坏、不自动尝试下一源。实际 Coordinator/Gateway DTO 回归通过。
- 独立只读复核确认：旧目录缺失但缓存存在时拒绝；分卷恢复核验标题；全部旧坐标保护覆盖无进度及邻章；缓存占用参与事务 CAS。最终 `cargo test -p reader-runtime --lib --quiet` 为 663 passed、0 failed、2 ignored；Storage SQLite 全量 302/302 通过，当前 diff 检查通过。结果尾日志位于工作区 `.reader-artifacts/test-results/20261012-trial-progress-runtime-final.log` 和 `20261012-trial-progress-storage-final.log`。Native/HAP/安装结果待补记。

### 产物边界

此前构建的 `20261012T121821Z-493e6315-ff195e6f` 没有包含最后定位的同源目录跳章修复，不用于本次完整修复交付。最终源码冻结后重新生成 Native 输入快照和 HAP。

最终 Core Native 重建及配套 SDK smoke 通过，Host `sync-native` 校验通过，SO SHA256 为 `d547455b6ca2d5647fbcfc5f4d1ddaf5d6acbe3fa456ecff26f306f282c92fbc`。首轮完整 HarmonyOS 合同四任务并发执行 674 项，667 PASS、7 FAIL，未发布或安装失败产物。完整结果和七项失败日志保留于工作区 `.reader-artifacts/test-results/20261012-harmony-first-full/`。

其中四项共享组件检查均指向 ReaderButton 的同一个半行距居中实现基线未更新；搜索物理布局断言仍为 17vp；漫画准入 fixture 未捕获新增的真实 Gateway 方法。已精确更新单一基线/夹具并定向通过，未放宽断言、输入预算或负对照。阅读设置失败的直接原因是旧正则不匹配 controls 快照；进一步生产方法负对照确认隐藏 warm Reader 的迟到设置/常亮回调会取得 Reader Window 所有权。

该真实窗口缺口已补：非 active 阅读页的统一入口完全不发出 Reader/App Window 请求，成功/失败设置加载及常亮回调都经过该入口；显式失去所有权边界恢复 App。负对照和修后日志为 `/tmp/reader-hidden-warm-negative-20261012.log`、`/tmp/reader-hidden-warm-positive-20261012.log`。另一个可见 Reader 已取得 Window 时，隐藏 warm Reader（身份回调可未提供）迟到成功/失败/awake 均零写入；控制栏绘制、顶部信息栏抑制及原生栏共用同一 controls 采样，音量策略不包含在该单次采样声明内。13 项相关合同通过，包含实际 SDK Chrome 顺序 32 场景，独立只读复核无新增阻断。Core 输入未变，Host 最终再次冻结以重跑完整门禁。

### 真机最小只读核对

当前代码已复现并定位实际跳章路径；仍未知用户原始书源，以及已经误换书后的历史进度/身份是否有可恢复记录。用户不记得原书源并明确回复原真机已连接。本轮重新发现真机目标，boot.completed=true。只读核对目的限定为该两本书的已有身份及历史记录；先读取 debug 应用数据路径，权限/可读性不明即停止，不清理、卸载、重放搜索或写入进度。

HDC 明确绑定已连接真机，debug bundle `pwd` 返回应用 debug 路径，但 `ls` 返回 Permission denied；文件目录核对未成功即停止，没有改权限或提取数据库。原始书源和设备历史身份/进度记录仍未知，不声称已核验用户数据库。实际跳章代码路径已经本地生产方法复现；没有在真机重放搜索、入架或换源。

真实磁盘 Runtime 回归覆盖真实 anchor/layout/bodyVersion/processingVersion/CAS：稳定目录保存第 325 章后，即使入架意图为第 3 章，progress.get、snapshot、first_frame 和冷重开均选择第 325 章；删除当前原文只返回 contentMissing，不降级选第 3 章。截短/身份不可靠刷新在发布前拒绝，保留进度和缓存。设备视觉及用户完整操作链验收仍独立待验。

代码、本地回归、设备行为和用户验收分别记录；本次没有清理用户进度或删除错误书架条目。已经持久化成第 3 章的历史进度不会无证据自动猜回第 325 章。旧设备已经丢失的文档由正常正文恢复链重建，迁移不伪造历史阅读位置。

## 最终交付结果

- 最终完整 HarmonyOS 合同：674/674 PASS，四任务并发，省略清单为空；ArkTS、非增量构建、包内 Native/书源内容及指定证书验签均 PASS。
- manifest：`.reader-artifacts/hap/20261012T130551Z-493e6315-ff0cd5ff/manifest.json`；signed HAP SHA256：`70cbaff43c4c47291a68c68b77796dd19e8296b507123f14a21158a5b0291ac9`。这是当前 dirty 工作树的 iteration 产物，`acceptanceEligible:false`，不提升为用户验收或已提交稳定版本。
- 重新发现用户指定原真机、确认 boot.completed=true；pipeline inspect 确认匹配签名身份、允许保数据更新。pipeline install 明确绑定该真机并使用上述 signed 产物成功安装；没有卸载、清数据或更换 VM。按最小安装范围使用 `--no-launch`，未自动打开应用/操作书籍。
- 部署回执：`.reader-artifacts/hap/20261012T130551Z-493e6315-ff0cd5ff/deploy-physical-b1f20b88963d-20261012T130938Z.json`。安装证据与实际书籍操作、设备视觉及用户验收分开；后者尚待用户复测。
