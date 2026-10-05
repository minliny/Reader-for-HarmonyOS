# 漫画阅读链路定位与修复

日期：2026-10-03。范围：现有漫画搜索、详情、目录、阅读、换章、重试与进度链路。沿用已确认 UI；不合入主工作区。

## 当前结论（17:40，MR-19 最终签名包）

MR-19“滑动时整片阅读内容跳动、闪烁”已完成代码修复、41 项漫画定向回归、433 项完整 Harmony 合同、ArkTS 全量编译与规范签名安装。当前滑动修复产物为 `20261003T092724Z-568ec4e3-1f9ba943`，signed SHA-256 `334cbc5ddd1c76857b949492869995d193fa5e02ab8a4c2c0d1cbf308a12b162`。保留 schema 34 和应用数据，签名为指定 minliny_HarmonyOS。

修复包含：相同尺寸不再误判几何变化并强制恢复滚动位置；仅当前位置之前的真实布局变化触发必要恢复；仍在屏幕内的图片块不会提前释放；无变化窗口与列表行不再重复发布刷新。生产方法/真实 SDK 的反例回归覆盖错误提示归属、缩放与宽度响应、异步退役及资源释放，没有另建图片缓存或渲染器。

同一新包在现有 Mate 80 Pro VM 完成慢滑、正向与反向跨页的 15 帧采样、4 次隐藏控件的快速滑动、普通退出重入及冷启动恢复。采样未观察到整片回跳或整片闪空，最终 05 第 4/32 页及页内可见位置恢复一致。快速进入新图片区域时曾出现底部待加载空白，随后补齐；重入也有初始图片加载状态，均保留原始证据。15 帧是有限采样，不是逐帧录像或帧率保证。

VM lease 已释放，并通知“架构优化”。结论仅绑定以上包与源码快照：仍是隔离 dirty/iteration 候选，未合入主工作区，`acceptanceEligible=false`、用户验收 OPEN。另一个任务正在继续修复目录内容样式与面板动效；本轮不将这部分计为 UI 验收通过，之后共同工作区的修改不能沿用本包验收。

- [MR-19 最终证据、原始采样及逐文件哈希](../evidence/2026-10-03-manga-scroll-flicker/final-pass/evidence.json)
- [冷启动恢复后的正文](../evidence/2026-10-03-manga-scroll-flicker/final-pass/manga-scroll-final-cold-ready.jpeg)
- [上一包首次采样超时记录](../evidence/2026-10-03-manga-scroll-flicker/first-pass/evidence.json)

## 历史结论（15:56；MR-19 后续修复以前）

**后续用户反馈：MR-19 滑动漫画阅读页频繁闪烁，重新打开阅读流畅度验收。** 用户反馈关联上一轮交付后的阅读现场；已知上一轮漫画包为 `20261003T074818Z-568ec4e3-ae09e248`，本轮已通过安装时间与原规范部署回执核实现场仍为该包（bundle updateTime=1791013746745）。用户确认触发为连续滑动时整片内容跳动、闪烁；后续代码定位见下段。先审计 Surface 的滚动→viewport→Controller publish→LazyForEach key/通知、图片解码与窗口退役，再以生产方法/SDK 回归定位；不把之前截图和短程翻页通过当作连续滚动通过。

MR-19 代码定位更新：用户明确为“整片阅读内容跳动、闪烁”。真实 Controller 0→3→0 中所有20个row的尺寸/key完全相同，旧 Projection 因 geometry 新对象触发2次结构刷新，Surface随之强制restore。后方邻页初次解码、横向未选页也错误restore。另查出首可见页±1元数据窗口会释放仍可见第三页tile，造成反复读显示文件。已按数值比较几何、仅当前/前方真正布局变化restore；Surface传入本次≤8真实窗口精确保留可见tile，默认远跳依旧及时退役。复用原LazyForEach/图片资源owner，不添加通用缓存。修复过程中独立审查发现retained pending metadata可能失去任务，已改仅保留ready metadata并以真实异步RED→GREEN封闭。

新增SDK回归旧逻辑RED3项、新逻辑全PASS；Controller重复三页窗口不新增decode/release，far/close/late pending与原session回归通过。证据：`evidence/2026-10-03-manga-scroll-flicker/local-evidence.json`。VM新包连续滚动尚未完成；本节历史正常阅读结论不覆盖此新问题。另一个对话正在同文件的面板builder范围修UI，本轮防闪烁修改限定Projection、Controller和Surface publish/updateViewport，打包需待双方源码稳定。

本轮识别 18 项：16 项代码/构建问题已修复，MR-06 排除为原有状态行为，MR-07 保留为包子上游宣传图片限制。腾讯官方免费漫画的实际正文阅读链路已在 VM 通过；继续阅读卡的最后两处展示残余也已在最终包验证关闭。下文“待验证/未交付”段落为逐轮失败历史，以本节及末尾最终回执为当前状态。

最终签名包 `20261003T074818Z-568ec4e3-ae09e248`，429 项 Harmony 合同、ArkTS 编译、签名、保数据安装启动通过。最终包完成真实正文、阅读目录 04→05、页码 1→2、筛选外继续卡、漫画→小说→漫画即时刷新、冷启动及详情往返的位置恢复。前一包的横向翻页、末页相邻换章证据仍按原 manifest 保留，没有将旧截图冒充新包截图。

这是隔离 dirty 候选的 **VM 功能验证通过**，不是主工作区合并、正式 clean acceptance 或用户 UI 验收。最终包仍为 `iteration`、`acceptanceEligible=false`。数据库保持 schema 34；已释放共享 VM lease 并通知“架构优化”任务。

- [最终 VM 证据及逐文件哈希](../evidence/2026-10-03-manga-vm-reading/final-pass/evidence.json)
- [真实正文与阅读控件](../evidence/2026-10-03-manga-vm-reading/final-pass/manga-final3-reader.jpeg)
- [冷启动书架和继续阅读卡](../evidence/2026-10-03-manga-vm-reading/final-pass/manga-final3-cold-card.jpeg)
- [详情恢复位置](../evidence/2026-10-03-manga-vm-reading/final-pass/manga-final3-detail.jpeg)

## 输入与证据边界

- Harmony 候选：`codex/manga-ui-20261002`，起始 HEAD `568ec4e32a2bdce01f62724cfb04a3f6b5a63a60`，含本轮未提交修复。
- Core 候选：同名分支，起始 HEAD `dfd729cffd79ed11da6d44be9e1ba10c4223247f`。
- 首次失败对应 HAP：`20261003T043026Z-568ec4e3-e530ce1b`；signed SHA-256 `7927a301677d5af3a44507f7baa891e93afcd01575aecbb12a8e4839ec74c4a1`。包名以实际 `AppScope/app.json5` 为准：`io.reader.minliny`。
- 既有 VM 失败日志：`/private/tmp/codex-manga-reader-new-hilog.txt`，12:35:16–17 图片请求返回平台错误 2300999、HTTP 0、TLS 未建立；截图 `/private/tmp/codex-vm-manga-reader-new.jpeg`。
- 2026-10-03 14:12 重新确认现有 VM `Mate 80 Pro`，实例路径 `/Users/minliny/.Huawei/Emulator/deployed/Mate 80 Pro`，target `127.0.0.1:5555`，boot completed=true，Emulator 有 Guest OS Boot Completed 日志，当前 hilog 未发现连续 SceneBoard 超时/退出。
- 同时运行的“架构优化”任务于本轮期间安装了 `20261003T061037Z-cf56c662-e8a92c93`。因此当前截图 `/private/tmp/manga-audit-before.jpeg` 仅证明当前 VM 状态，不能当作本漫画候选的修复前后比较。后续漫画验收须重新核实占用和安装身份。

## 问题清单

| ID | 现象与触发 | 定位 | 修复与验证状态 |
|---|---|---|---|
| MR-01 | 包子漫画目录可进入，图片 TLS 失败，页面无正文 | 内置旧规则 `class.comic-contain@img@html##cdn##mh` 将页面实际 `s1.bzcdn.net` 改成 `s1.bzmh.net`。前者 HTTP 200、后者 TLS EOF 的对照已有初步证据；需以相同 URL 留存复核。不是 ImageKit 解码错误 | 已修复原域名规则并升版供应；同 URL HTTP 200 JPEG / 改写域名 TLS EOF 对照及生产解析回归通过。保留用户自定义。 |
| MR-02 | 章节首次准入失败后没有可用的重试入口 | 打开章节与单图 retry 是两个状态；原 UI 仅提供图片重试 | 已补 retryOpen 与重试中禁用态；生产 Surface/SDK 回归通过。 |
| MR-03 | 多页失败后，滚动或前一页恢复可能导致当前页空白、无重试 | 单错误卡的 owner 随 viewport/邻页状态变化，但 LazyForEach key 未包含 owner，旧 Blank 分支被复用 | 已修 owner key 与恢复时序，滚动/前页恢复回归通过。 |
| MR-04 | 图片恢复后仍残留全局失败提示；异步失败可能覆盖新状态 | 重试完成和全局错误缺乏相同 session/viewport 的绑定 | 已绑定 controller/chapter/presentation，迟到成功/失败回调回归通过。 |
| MR-05 | 源目录标题为空或只有“第话” | 标题投影未在目录、详情、阅读统一兜底 | 已在四处入口统一保留合法标题、空/第话按索引兜底；本地回归通过。 |
| MR-06 | 初始搜索页没有小说/漫画筛选，被误判为缺功能 | `SearchPage` 仅结果/空结果态渲染筛选，结果态的两行筛选已有截图证明 | 排除，不改初始页行为 |
| MR-07 | HTTP 200 不一定是漫画正文 | 包子部分公开章节返回站点宣传图；URL 可达不能证明阅读可用 | 已确认该源部分响应为宣传图；不据此宣称可读。改用腾讯官方公开免费首章 36 页，前两张真实正文已下载核对；待 VM。 |
| MR-08 | 书源修好后，已有失败章节仍可能打不开 | Core cacheFirst 直接返回旧 manifest；版本不匹配时只移除 resources，Host 按无网络资源尝试本地读取，并未重新获取新规则清单 | Core/Host 已补源版本与目录恢复，49 项 Runtime 回归和 Host 同版/变版恢复通过；cacheOnly、禁用/删除源和旧进度保留。 |
| MR-09 | 确认恢复期间遇到图片签名刷新，UI 提示被清掉但 Core 仍要求确认；晚到回调可能写入新页面 | topControls 内 selectPage 的 then 无条件 recovering=false、无生命周期检查与 catch | confirmRecovery 已读取 Controller 实际恢复状态并绑定 presentation，定向回归通过。 |
| MR-10 | 腾讯漫画搜索、详情、目录正常，但第一话无法解析 | 旧 source JS 的 picture 正则贪婪匹配到后续 ads，eval 非法；nonce 提取还缺全局字母边界。相同原始响应、真实 manga.pages.extract 已重现并以修正案提取 36 页 | 两个受控源修正 nonce 与 JSON.parse，版本 v7。真实生产提取各 36 页，两个 L1-L5 通过；不修改通用 QuickJS。 |
| MR-11 | 定向书源升级可能覆盖用户只改过的旧 contentRule 别名 | 旧规则指纹不包含该兼容别名，单凭规则指纹无法区分用户修改/删除 | Core/Host 已校验 correction provenance 的审核前后值；原值/新值/明确旧缺失准入，自定义/删除保护。供应 8 项与 1046 条全量指纹校验通过。 |
| MR-12 | Native 构建成功后 sync-native 拒绝 Core 身份与当前 worktree 不一致 | reader-runtime/build.rs 仅监听 Cargo.lock、protocol、Git HEAD/index 和输出路径；修改已跟踪业务源码不保证触发 build script，保留旧 gitDirty=false 身份。2026-10-03 本轮 Native exit=0、SDK smoke=pass 后被生产 provenance 预检拦截 | 已让 build.rs 监听规范构建已有输入快照；真实 Cargo clean/dirty/docs/new commit/缺失快照回归通过；重建已产生正确 gitDirty=true，Native/HAP 验证进行中 |
| MR-13 | 冷书架入口后，新目录已回传父组件，但下一话仍禁用、阅读目录为空 | Surface remoteSession 是普通字段，ArkUI retained-child 更新不会重设该字段；SDK lowering 的 updateStateVars 为空，父层新 session 未进入已有 Surface | 已改 @Prop，并以真实安装 SDK retained-child 属性更新和冷缓存 Controller 验证目录/下一章到账、owner 不重建；定向回归通过 |
| MR-14 | 放大图片后点击详情/加入书架导航，只重置缩放而未退出执行 | onExitRequestHandler 注册时丢弃导航 intent，handleBack 统一进入缩放返回分支；生产方法探针 exits=0,saves=0,resets=1 | 已保留 navigation intent；明确导航等待保存后退出，普通 panel/end/zoom 返回保持；实际注册回调和迟到 disposal 定向回归通过 |

## 交付门槛

本地生产方法/SDK 回归、版本化书源供应校验、唯一 pipeline 签名 HAP、保数据安装、同一 HAP 的实际漫画正文像素、翻页、换章、退出重入进度恢复分别记录。源码、构建或宣传图片不能替代正常漫画阅读证据。共享 VM 在验收窗口外被其他候选覆盖时，停止沿用该现场并重核身份。

## 首轮真实阅读追加问题（未交付）

- MR-15：签名包 `20261003T065125Z-568ec4e3-559f9de5` 真实 VM 中页码、上下控制栏均落在屏幕中央；书名 bounds `[521,1386][759,1472]`、底部操作约 y1533。Surface 对子控件使用 `.align`，没有定义承载全屏 Stack 的布局位置。修正为独立全屏 Top/Bottom/BottomEnd 容器并验证透传；待新包复测。
- MR-16：腾讯无分卷规则时 Core 没有 v2 hierarchy facts，阅读内目录只显示“当前目录结构暂不可用”；详情/完整目录已有 681 条可靠平面目录。复用已有 ReaderDirectoryList/ChapterRow/projection 补阅读内平面 fallback，并让无 proof 的已准入条目走现有 canonical chapter 导航。待新包复测。
- MR-17：01 换至 02，读到第 2/24 页后普通 Back 返回详情仍显示 01 第 2/36 页；冷启动书架和冷重入均正确为 02 第 2/24 页。证明持久化成功，详情快照刷新漏接。修复共享返回和同 revision 投影补齐，待新包复测。
- MR-18：冷书架已知 681 条漫画目录仍显示 *%，且继续阅读卡停留上一本小说。定位为 Host 百分比硬编码、Core 清空漫画章节投影、漫画 CAS 未更新书架 lastReadAt、有进度筛选仅认小说、书架 revision 未覆盖漫画写入。补齐同源可读目录映射后的章节比例与最近阅读事实；未知或歧义映射保持未知。复核发现时间必须遵守原契约 Unix seconds，已纳入小说→漫画→小说排序回归。保持 schema 34，复用既有 clock，不增加迁移或伪造小说进度。待最终构建及 VM 复测。

该包构建、验签、保数据安装启动通过，签名 SHA-256 `069307e02cc4c54c2eaec13dcb949ea2f73dd544828f71047290c26441ecd78f`；真实搜索/详情/首章36页/竖向阅读/完整目录换至第二话24页/冷启动进度恢复/横向翻至第三页通过。证据位于 `evidence/2026-10-03-manga-vm-reading/first-pass/evidence.json`。以上 UI/展示问题仍阻断最终交付。

MR-18 边界复核：当漫画目录缺失或 URL 映射歧义，Core 正确不提供 currentChapterIndex，但 BookshelfFlowGateway 的继续阅读快路径只识别该字段或小说 readingPosition，可能跳过更近的漫画并显示旧小说。该候选须触发现有全局有进度查询，不在 Host 猜章节位置；已分配定向修复。

MR-17 并发复核：`refreshDetailAcquisitionProjection` 的后台元数据请求在 await 前缓存 book；期间正确更新漫画位置后，迟到元数据仍用旧 book.mangaPosition 覆盖详情。生产方法探针已复现，需在结果准入后读取当前同作品的 MangaBookPresentation，而非旧快照。

## 冻结后的本地验证

- 全部 36 组 `tools/test-manga-*.mjs`（排除常驻 server）通过，MR-13/14 后重跑 26.2 秒；含生产 Surface/Gateway/Controller 与 SDK Builder 的错误卡交接、晚到回调、位置确认，以及同版/变版缺图恢复。最终日志 `/private/tmp/manga-host-final-mr13-mr14-regression-20261003.log`；冻结 Surface SHA-256 `e32ae491de55be26622307bed983620ba85563691c5fe639d48e8fa42f1bfe11`。
- Core 漫画 Runtime 集成 49/49 通过；包括更新目录后续期、旧目录拒绝、旧进度/manifest 保留、刷新失败保护、cacheOnly/禁用/删除/转小说的零网络旧缓存读取。
- Core source_supply 8 项通过；单独执行原默认忽略的完整 bundle 指纹检查，当前 1,046 条全量通过（本次 1 passed / 0 ignored）。
- Baozi 生产规则回归 1/1；Tencent 生产规则回归 2/2。腾讯两个受控变体均以真实 `manga.pages.extract` 提取公开第一话 36 页，真实网络搜索/详情/681 项目录/正文链路通过；前两张图 HTTP 200 且确认为正文扉页。
- 定向供应修复及旧 Host 升级测试通过；供应集合只更新 Baozi 1 个和 Tencent 2 个受控记录，保留用户修改、禁用、发现配置和删除记录。
- Core/Harmony `git diff --check` 通过。主工作区未合并；所有修复仍在本隔离候选。

当前状态：本地修复已通过，Native/HAP/VM 连续阅读验收进行中，尚未交付。

正式构建首次回执：427 项 Harmony 合同通过；ArkTS 编译拒绝 MR-11 新代码将 `JsonObject` 的 unknown 字段直接传入 canonicalJson（4 处参数类型错误，BundledBookSourceSupply.ts:132/134）。无发布产物、无安装。已改为先构建单字段 JsonObject 再使用既有 canonicalJson；实际 Owner 别名保护与两个生产 36 页回放重跑通过，正在重新执行唯一流水线；日志 `/private/tmp/reader-manga-hap-20261003.log`。

第二次构建输入异常：`test-transient-transport-acquisition.mjs:44` 读取 `entry/vendor/core-harmony/sdk/reader_core.ts` 返回 ENOENT，整个 `entry/vendor/core-harmony` 缺失，Git 显示 6 个受控文件删除。之前规范 sync-native 已 PASS（Native SHA `a4f1000d0cb6f4d823a5d3125389a05168fd145b13bcd55feb7059a2cd3f3acc`），首轮 427 项全量也读取成功。14:43–14:44 配套私有恢复目录时间发生变化；尚无证据确定删除原因，不能归因于 VM 或另一任务。先经唯一 sync-native 从当前已验证 Core 包恢复，另行只读审查测试/清理路径。失败日志 `/private/tmp/reader-manga-hap-final-20261003.log`，无发布、无安装。

## 本轮 VM 最小验收范围

最终冻结补充：MR-15/16 的 37 组漫画 Host 回归与真实 SDK 编译投影通过；MR-17 的普通/Info 返回、同 revision 与迟到 metadata 并发生产方法回归通过；MR-18 的 Host 未知目录候选、跨源身份、Core 否定读时和小说优先级回归通过。Core manga store 27/27、shelf projection 6/6、Runtime 章节比例定向 2/2 通过；Native 正在以冻结源码重新构建。继续阅读与百分比复用原协议字段，数据库版本保持 34。

最终候选第一次编译回执：Native 构建和 sync-native 通过，SHA-256 `63f1690eb95f9a83dde42cb805adb14e822fea00bfc37b10193e5c997f1fcf27`；HAP 全量合同通过后，ArkTS 拒绝 Index.ets 的对象展开（arkts-no-spread，刷新详情位置的 clone）。已按 ReadingBookDetail 完整字段显式复制，实际 hydration/并发/SDK retained-child 回归再通过；重新进入唯一 HAP 流水线。失败日志 `/private/tmp/reader-manga-hap-mr18-20261003.log`，没有产物发布或 VM 安装。

最终包 `20261003T072625Z-568ec4e3-0320176a` 已通过 428 项合同、ArkTS、签名、manifest verify 与 VM 身份 inspect；signed SHA-256 `27f6dd3617b9934ab3eff0567b03672137097d2f77430b828e6221d060bcc05c`。15:28 保数据安装被 VM 返回 9568288（insufficient disk memory）阻断，未清空数据或卸载；先只读定位可回收临时文件，失败日志 `/private/tmp/reader-manga-vm-final-install-20261003.log`。

空间恢复：VM `/data/local/tmp` 历史测试证据占约 3.9 GB。仅将 109 份超过 5 天的 `reader-control-*.ftrace` 归档到私有 `.reader-local/vm-temp-archive/20261003`，逐文件 SHA-256 对照成功（原文件 804,416,764 bytes），再次核对远端 hash 后移除远端这些副本和临时归档。没有清理书籍/书源/数据库/应用缓存；可用空间 0.9→1.7 GB。随后同一 manifest 保数据安装启动 PASS，回执 `deploy-vm-6460677a198b-20261003T073048Z.json`。

第二轮 VM：该包真实正文、上下控制栏、右下页码、阅读内目录、02→03选章、03末页→04相邻话、横向翻页、竖向连续阅读、Info返回04第2页、普通返回详情04第3页和冷恢复04第3/24页通过。书架列表已显示04第3/24、章节进度0.59%，但继续阅读卡仍有两个Host残余：返回时留旧小说，冷启动后虽选漫画却显示“尚未阅读”。继续卡点击后的实际漫画进度恢复正确，持久化未丢失；正在定位修复该展示层。证据在 `evidence/2026-10-03-manga-vm-reading/second-pass/evidence.json`，仍不作为最终交付。

继续卡残余已代码定位并修复：实际 SDK retained ListItem/Builder 捕获初始 book 参数，导致文字/封面/点击目标停留旧小说；BookshelfPage 又未订阅 manga presentation revision。卡片改为读取当前 @Prop，接入已有 revision，未知漫画位置留空并保留 15vp 行高。Index 的 retainIdentities 追加独立全局漫画继续卡（最多 1 个身份），避免筛选/分页将其位置清除；不扩大全目录或请求范围。实际 SDK mounted probe 与既有 hydration 测试均先复现 RED、修后 PASS，覆盖图文/点击、仅 revision 更新、反向小说、异源同名、空属性、分页回收、owner 切换。新 HAP 待重建；Core Native 保持上一轮相同字节。

继续卡重建首轮本地门禁：旧 `test-phone-layout-figma-regressions.mjs:30` 的源码正则绑定原 `continueReadingCard(book, isTablet)` 参数形式而失败；宽度实现仍为响应式 `shelfContentWidth(isTablet)`。已将签名匹配更新为修复后的 `continueReadingCard(isTablet)`，保留原宽度断言，定向 PASS；本轮无产物、无安装。日志 `/private/tmp/reader-manga-hap-card-final-20261003.log`。

- 用户已明确授权与“架构优化”任务协调，漫画优先验收；对方已确认本轮无在途设备命令、暂不覆盖安装。安装及交互继续使用共享 HDC lease，目标只限现有 `Mate 80 Pro` / `127.0.0.1:5555`，保留应用数据。
- 代码侧已审计规则、资源续期、源版本/目录版本、缓存准入、错误卡所有权、重试迟到回调、位置确认、用户自定义字段保护；上述本地回归不证明 ArkUI 实际图片像素和 Harmony HTTP 请求。
- 待 VM 回答：同一签名 HAP 中腾讯漫画免费首章是否显示正文；连续翻页是否正确；目录选章/相邻换章是否工作；退出重入是否保留已确认进度；控件/错误提示是否遮挡正常阅读。
- 样本：搜索 `斗破苍穹` → `🔖腾讯漫画` → 官方作品 `id/531040` → `01` / `cid/1`。只读公开免费内容，不使用包子宣传图作为通过证据，不修改其他书籍数据。
- 安装回执、截图、章节/页码与所选 manifest 一起归档；UI 用户验收仍由用户决定。

## 最终构建与 VM 回执

- Manifest：`.reader-artifacts/hap/20261003T074818Z-568ec4e3-ae09e248/manifest.json`；部署回执：同目录 `deploy-vm-6460677a198b-20261003T074908Z.json`。签名 HAP 实算 SHA-256 `efb9de39eb25343365c3fc4d588e5f91f5453f4be181de45ae9b5f097ff18fc9`，唯一证书 `minliny_HarmonyOS`，验签通过。
- Native 输入 SHA-256 `63f1690eb95f9a83dde42cb805adb14e822fea00bfc37b10193e5c997f1fcf27`；包内经规范 strip 后 SHA-256 `a93a5bbeded3d4b8faab37a24005cfb62daf715c0f9e32aec9e3676fb1c9c7dc`。Core 输入快照 SHA-256 `99d6dfa1036f51b60e0167d96012c781ddd31c858d394a464b2198f6dff5e5c4`。同源及 schema34 已独立复核。
- 本地门禁：Harmony 合同 429/429；Core manga Runtime 51/51、manga store 27/27、shelf projection 6/6、source_supply 8/8；1046 条供应指纹全检通过。错误恢复、晚到回调、未知目录、跨源身份和用户自定义保护属于本地生产方法/SDK 测试覆盖，未据此宣称逐项 VM 故障注入通过。
- 目标：现有 Mate 80 Pro VM，`127.0.0.1:5555`，HDC server `127.0.0.1:8710`；包名 `io.reader.minliny`。规范保数据安装及启动通过，未卸载、清应用数据或修改数据库版本。
- 最终包实测：冷启动卡片 04·3/24；小说筛选下全局漫画卡保留且点击进入正确正文；阅读目录定位04并选择05，获取32页；翻至2/32后普通返回，卡片立即更新05·2/32；读小说第四章后卡片变为天蚕土豆/第四章；再读漫画后卡片返回知音漫客 x 任翔/05·2/32。恢复全部筛选后列表显示章节比例0.73%（5/681，与章内2/32分开）；进程 force-stop/start 后卡片及点击阅读仍为05·2/32；更多→漫画详情显示05、2/32和681可读条目，再继续阅读位置一致。
- 证据边界：`first-pass`、`second-pass` 保留各自 HAP 的失败及通过项；最终 `final-pass` 独立绑定新 HAP，26 个截图/布局文件均有 SHA-256。前包的控制栏、横竖切换、章末相邻换章及详情普通返回通过后，最后改动仅为继续卡响应性、位置保留及对应测试，没有重复扩大设备测试。
- 15:56 HDC helper 明确返回 `lease-released`；无在途安装/构建/设备命令。已按用户授权通知“架构优化”任务恢复使用。现场为腾讯漫画05第2/32页、竖向模式，书架筛选已恢复全部。

交付限制：未合并主工作区，未生成 clean acceptance 包，也不代替用户 UI 验收；没有宣称全部书源、收费章节、真机或所有异常网络条件通过。包子源部分上游宣传图仍单独列为限制，腾讯公开免费实际正文才是本轮正常阅读证据。

## MR-19 重新验收记录（16:40）

- 新包前的现有 VM 已完成 readiness：同一 Mate 80 Pro / 127.0.0.1:5555，boot completed、SceneBoard 存活，无本次窗口的连续生命周期失败。基线采样绑定旧包 20261003T074818Z-568ec4e3-ae09e248；有限静帧没有完整捕获用户所述频繁闪烁，不能冒充视频或 FPS 证据。代码旧逻辑 RED 则明确复现不必要的整表刷新/restore 与可见图片释放。
- 本轮防闪烁修改保持冻结，另一面板任务负责共同构建和一次保数据安装。我们未抢占安装或覆盖其面板代码。初次自主构建遇全局构建锁，立即停止，没有产物。
- 共同构建的最终尝试在 MR-19 新增回归通过后，被 test-svg-provenance 拒绝：22 个新增 manga_sheet_*.svg 尚未写入 trusted provenance registry（sync-svg-assets.mjs:247）。本次无新 manifest、无安装。需由面板任务补齐登记并重跑规范流水线；不得跳过原门禁。
- 待新包最小 VM 验证：真实腾讯漫画 05 的慢速连续下滑/上滑、跨页解码及快速往返；观察是否出现非手势导致的位置回跳、整片空白；普通退出和重入位置保留。有限采样不等于全帧性能测量或用户验收。

### MR-19 新包首轮采样异常（17:10，未通过）

新包20261003T085836Z-568ec4e3-3dcdb3db已432合同/ArkTS/验签/保数据安装通过；独立核对三生产与两测试快照匹配。VM更新时刻1791017961092，boot completed、SceneBoard pid15675、短窗口hilog无生命周期超时。05第3/32页竖向暖纸，隐藏控制栏后受控采样drag(700,2240→700,650,500)。截图耗时5.5/4.8/3.2/3.4/9.3秒，拖拽30秒SIGTERM退出；探针按停止条件结束，未自动重试。采样显示内容缓慢向前、局部后方暖纸空白，没有捕获整片回跳，但不能据此判定正常滚动通过。

剩余问题：是否为Surface→Controller无变化publish→List通知→滚动回调反馈、tile请求取消/反复解码，或VM/宿主资源瓶颈。先代码生产方法/SDK审计前两项，并最小只读检查宿主/VM资源、现有hilog；在原因明确前不继续手势测试、不改签名或清数据。日志位于/private/tmp/manga-scroll-after-20261003/reader-control-probe-1791018589659-ef2e13d7-ed8c-436f-9c17-23703da3103d.jsonl。

### MR-19 无变化刷新修复（17:21 冻结）

代码生产探针确认：Controller 同一 ready 窗口50次调用、解码与释放均0，但旧版发布50次；实际SDK同first/last回调20次导致20次窗口提交、60次行通知。已将Controller初始通知限定为真实呈现变化，保留pending注册、完成、失败、重试、退役和无用metadata释放；Surface按最多8行的既有renderKey只通知变化行，并去重同range加载工作，首次回调/恢复测量保留。实际组合回放变为1次窗口提交、0无效发布/行通知/解码退役。

独立复核补齐：全失败且geometry未知、tileWindow为空时，first0→1必须主动更新错误卡owner；现在row1从Blank变为重试仅通知1次，重复窗口0通知。旧边界精准负控RED、新逻辑GREEN。真实SDK确认zoom、viewportWidth、errorColor由State/Prop依赖更新保留组件，0无效行通知/0重挂；session17组、viewport restore、render-key、assembly、navigation/motion/tile/ui-state/strip等回归通过。旧方法探针新增真实helper/Map装配，原restore断言没有放宽。

共享VM最小只读排查：SceneBoard存活，Reader RSS约367MB、VM可用约1.36GB，宿主free42%，当前hilog没有生命周期超时/ANR；这些静态读数不代表滚动期间性能正常，也不证明原生无限回路。已排除代码中的无变化重复工作；剩余仅由新包回答实际手势是否按时完成、连续上下滑动是否仍出现整片跳动/局部空白，以及保存重入位置是否保留。

规范重建日志/private/tmp/reader-manga-scroll-final-20261003.log。Surface SHA a1c24c6b7008f049d535131866ce8276a11c16e9634805a3b16feef69610d8db；Controller 88007c3ced534ee439348af492de53942c28606127313e8912d714fe60390857；Projection a478eaf8d41cdc1d3fe097f53dab2982fe9ea5a5a68fe20ab7839fdea16c0363。完整HAP与第二轮VM仍OPEN。

17:22规范构建早期门禁失败：test-manga-cancelled-banner.mjs 的旧fake controller缺visiblePages()，新增真实差分helper→rowRenderKey调用因此TypeError。无新HAP/安装。已安排补真实接口夹具并跑完整有界manga测试；不在生产代码加入测试专用兜底，不弱化原取消/错误断言。日志/private/tmp/reader-manga-scroll-final-20261003.log保留该失败。

17:24：旧取消提示及跨章节页数探针的两个fake Controller接口已补齐，全部41组有界漫画测试PASS（无失败/超时）。生产SHA不变，原断言保留。新规范构建日志改为/private/tmp/reader-manga-scroll-delivery-20261003.log；前一失败日志不覆盖。
