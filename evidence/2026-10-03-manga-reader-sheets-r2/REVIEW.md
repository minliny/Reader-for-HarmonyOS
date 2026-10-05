# 漫画目录内部与弹窗动效二次审查

## 问题登记

- 触发：VM漫画阅读控制栏打开目录，用户反馈内部样式完全错误，弹出动画与已批准 demo 不一致。
- 设计：`evidence/2026-10-02-manga-ui-demo/src/Prototype.tsx`、`prototype.css`、`mobile/BottomSheet.tsx`、`styles.css`；本地4197。
- 历史安装：`20261003T085836Z-568ec4e3-3dcdb3db`，signed SHA256 `c987218631693c92c3f437f38785e391392fc8331676ca90a3c705d0817929aa`。该包构建/签名/安装成立，目录视觉与完整动画对齐结论不成立。
- 源码：独立 manga-ui-20261002 worktree，Harmony `568ec4e3` / Core `dfd729cf`，均有未提交共同工作，不覆盖漫画滚动线程的变更。
- 证据：上一轮原始VM JPEG/UI树、实际demo源码、当前ArkTS、同SHA字体fvar默认wght100、SDK fontWeight variable选项及曲线接口。

## 确定原因

1. 字体：实际VM没有按同源自定义CFF2 VF的请求字重绘制，默认轴100呈现极细；补variable flag后仍FAIL，不能把具体原生renderer/缓存分支归因当成已证明。项目2026-09-11既有静态字面规避，本轮未沿用是实施遗漏；其他面板文字还混用系统字体。
2. 箭头：手写Path物理坐标未按13vp缩放，形状也不等于Radix ChevronRight；改为同版本真实SVG及固定颜色来源记录。
3. 目录：间距、卷组边线/章数/辅助信息不完整；自动居中与demo打开50、定位12的顶部留距不同。
4. 动画：没有transition/animateTo，立即挂载/销毁；缺少160ms遮罩、不同进入/退出弹簧、保留退出节点、抓手下拖/下甩关闭及键盘处理。
5. 验证遗漏：仅静态几何/颜色/参数SDK通过，不能证明实际VF字重、Path像素范围或时间过程；旧结论撤回。

## 追加定位及回归边界

- 真实 Gateway 已将 v2 depth 转为一基，List 再加一次造成子项42而非26vp缩进；新增真实 wire→Gateway→SDK 链及旧depth负控。
- onFrame 在当前SDK定义为新帧正在render时回调，单callback不能保证初始状态提交；改为首callback仅安排下一callback，保留完整初帧。
- 正在退出时单独 `.enabled(false)` 无法取消已发起的目标解析；补实时interaction/generation拒绝迟到结果。
- 卷组 expanded 被放进rowKey造成Image重建；漫画组采用稳定身份、既有12page有界cache实时节点与实际状态驱动更新，同actor旋转须独立验证。
- TextInput 无VF选项，使用既有静态400及 checked FontCollection owner；常驻目录也必须等receipt而不借用手机open入口。
- Core新增parentTitle/readableDescendantCount两个只读投影事实，数量来自完整权威树的target前缀，折叠/搜索/分页不改变；24项directory定向测试通过，新旧sidecar列升级已验，不迁移用户主数据。
- 配套Native SDK/NAPI重建与规范sync-native通过，SO SHA256 `70a312763d3e4c6b2d0602a287094c9ca256b55e0f2012e7ed6835742127d0b4`。此项不代替新HAP或VM证明。
- demo实际浏览器记录在 `demo/`，完整三面板开闭WebM为25fps、8.4秒，353个rAF DOM样本；实际字体/行位置和图像均保留。失败尝试的page@*.webm是未完成/错误选择器过程，不作成功证明。最初Python Playwright缓存版本缺失，复用已有Chrome，无下载新依赖；两个入口/按钮精确名称匹配失败后依据真实DOM修正。
- 本轮Core新增缓存升级test最初误用未引入tempfile依赖，编译失败；改用既有标准库临时路径后24项PASS，未新增依赖。
- VM只读发现Connected、boot=true、SceneBoard15675；`pidof SceneBoard`无值后以实际完整进程名确认。系统bin无screenrecord，仅snapshot_display/uitest；hilog错误误用-t150已记录，不能当无异常证明，安装前用正确参数重查。短租约已释放。

## 未具备生产事实的设计项

‘整卷可读’并不能由标题含卷或URL推断。当前Core事实只有Group/Leaf/Unknown；已有明确组树可补真实数量和父组，但可读整卷身份缺可靠事实，仍OPEN，不伪造demo示例。真实当前源为扁平章目录，卷组运行验证与其静态截图必须分开。

## 计划与边界

先修代码并做实际SDK/lifecycle回归，所有审查完成后才构建一次规范签名iteration包。共享VM正由“漫画 UI 补全”使用，安装前协调占用并绑定新manifest，保留数据。新目录截图及连续动效取证才可评估视觉；真实源没有卷组不能伪造组场景。分开记录代码、本地/SDK、产物/签名、VM视觉及用户接受。当前修复和新包/视觉均待完成。

## 本次 HAP 构建输入失败

- 2026-10-03：首次新 build 在 provenance 预检停止，`entry/vendor/core-harmony` ENOENT；未到合同或 HAP 发布、未安装 VM。
- 17:47 `sync-native` 回执为 PASS，当前目录缺失，私有 recovery 内保留 previous-sdk；实现顺序已审查，缺失原因尚未证明，不能以旧 PASS 代替当前输入。
- 将重新走同一 `sync-native` 入口，核对当前 SDK 完整字节与 Native 配套，再冻结并重新构建；不从旧包取 SDK 或 Native、不改签名。

- 重新sync-native被严格校验拒绝：当前Core生成包中多出6个 ` 2` 名称SDK副本，manifest只列原6个文件；对应暂存目录同样出现额外副本。上次PASS快照没有这些额外文件，当前SO仍为同SHA。额外文件与vendor消失的制造者/原因未证明；sync实现PASS后没有删除分支。保留文件清单及副本后通过既有Native build重新生成包，不放宽校验。

- 重建成功：SDK smoke及Native identity通过；再sync-native为PASS，current SDK6个规范文件现场存在、无额外副本，SO仍同SHA，`git diff --check`通过。private recovery sync-J8Q4PK。最初build输入失败及第二次sync失败原日志均保留。
- 当前VM现场：Emulator PID32275 / Mate 80 Pro / deployed目录；当前实例日志2026-10-01 20:05:05.849 Boot Completed；HDC127.0.0.1:5555 TCP Connected，guest boot=true，SceneBoard15675/Engine15881从00:14稳定运行；正确hilog短窗口未见生命周期超时/退出循环。架构线程最新明确将VM留给本次窗口；交互租约先前已释放，安装仍需单独规范inspect。

## 完整 Host 合同门禁失败

- 第二次HAP build在`test-reader-control-p0.mjs:233`停止：全局reduceMotion转发次数4与旧预期3不符。新漫画面板转发已由实际SDK motion gate验证，产品新增正确入口触发旧数量断言；需分别检查四个组件入口而非任意放宽。原始log `/private/tmp/manga-r2-hap-build2.log` 保留，尚无新HAP/安装。motion owner只修此test与问题记录后冻结，之后重跑完整规范build。

- P0测试修为真实SDK ETS AST逐入口接线保护，保留旧3入口并检查Manga入口；4个断线但补计数负控均拒绝，P0及motion门禁通过，未改product。剩余237项预诊断236PASS，唯一目录fixture在sandbox因localhost listen EPERM失败；同构建的正确环境单项复跑PASS，无产品断言失败。所有原log保留。现在冻结源码/测试/文档，继续完整规范build，预诊断不代替规范全门禁。

## 新签名包 VM 字体绘制 FAIL

- 新run20261003T102024Z-568ec4e3-35ecf0a6，signed240cca544aa56f2b5d507437364edddab15d9b378c8d8872625069ae281fcf94，435门禁/ArkTS/package/验签/VM保数据安装启动PASS。当前05、5/32保留。
- 新实图vm/dir-open/frame-21.jpeg：箭头13VP、打开留距已变，VF550/400/900在当前平台仍画出极细轴，连原900标题也变细。SDK正确请求不证明物理字重；字体视觉FAIL，不能交付“已对齐”。优先审查字体注册与当前Native权重语义，复用已存在静态实例生成/字体加载，修复后本地回归及新产物。
- 首次采样collector读取/proc/uptime被SELinux拒绝，空时间窗口不能判时长；保留22张原JPEG，仅按图判断。date +%s.%N原生只读验证可用，后续collector改原生date并校验时间读取成功，唯一目录避免混旧文件。此项为取证脚本问题，不归因App。

## 固定字体及内部全项复查

- 两名独立审查均确认新包字体FAIL。复用当前实图正常的静态400；以现有同源FontTools4.60.2实例化550/600/900，保持完整CJK glyph/cmap/layout，无重复自研插值、无子集。独立单字面family/PostScript名防止旧Thin同名，保留原版权及OFL；不改全局VF别名或旧400/500/700资源。
- 四种字面只在漫画弹窗/常驻漫画目录准入时等待既有checked FontCollection回执，不进入书架启动预算；拒绝/重开/卸载/迟到回执必须有回归。
- 全项复查额外发现：搜索结果仍沿树层级缩进而demo平铺；漫画亮度Slider范围1-100与demo20-100不符；Toggle缺少明确off/knob色；宽屏侧栏宽度/标题/抓手仍复用手机样式。先登记后代码修复，不能用字体修复覆盖这些差异。
- 22原图仅frame4捕获进入尾段相对最终frame5向下34px，关闭基线0-3与终态5-21各完全相同；遮罩frame4已是终态。证明有平移中间态，不能证明完整曲线、时长或遮罩fade。

- 固定字面生成完成：FontTools4.60.2；550/600保留31,036glyph/30,890Unicode，900仅四固定标题字集14Unicode/15glyph，减少约7.94MB资源。三新增共15,428,204bytes，旧资源不改；最终SHA在docs/ui-design/MANGA_SHEET_FONTS_PROVENANCE.json。字体为静态CFF2，与当前VM正常400格式一致，无fvar/HVAR/VVAR/VarStore；成熟setRibbiBits统一单face Regular命名及flags，原版权/RFN Source/OFL保留。
- FontTools实例化有VORG未随VVAR更新warning：控件使用横排，不把该warning当成无信息损失证明。首次查询setRibbiBits误查names模块报ImportError，改用正式instancer导出，无产品失败。
- font-demand生产方法回归PASS：书架不预载；新增字面共享checked加载；两份receipt仍不准入；900失败后只重试失败字面；完成后不重复load。资源SHA/来源/字集已绑定，SDK/VM视觉仍待新HAP。
- 额外规则差异登记后修复：恢复默认原为source适配/强制暖纸/automatic brightness，demo为width、保留底色、78%manual；当前持久偏好不硬改成demo初始fixture。

- R3完整构建在产物预检停止：Core build inputs changed，未进入合同/签名打包或安装。当前两个SDK目录都是规范6文件，没有本次‘2’副本；保留/private/tmp/manga-r3-hap-build.log，先核对Native已绑定Core快照与当前字节差异，再按既有Native build重建并sync-native，不绕过准入。

## 共享 Core 输入后续变化及隔离

- 当前输入漂移已保存 `core-input-drift-r3.json`：5个 storage 文件和新 `manga_retention.rs` 引入 schema35 的3张表。两个已知线程均未确认是实际写入者，归属仍未确认；此项不能归因某一线程。用户已被询问归属，未收到答复。
- 最初不带sqlite feature的5项PASS仅覆盖内存，不能证明SQLite迁移。随后 `cargo test -p reader-storage --features sqlite --test manga_store` 33项PASS（含v34→35保留原行、retention及快照），完整storage现有回归退出0。原始日志 `/private/tmp/manga-r3-storage-sqlite-regression.log` 和 `/private/tmp/manga-r3-storage-full-regression.log`，现有回归不代替未知新增功能的完整性审查。
- 独立只读审查发现新session保护API尚未被runtime调用，且有同章多session覆盖、重启遗留保护及旧Core读取新retention备份的边界。此非本轮UI修复范围，不修改共享Core、不宣称功能完成；优先尝试在临时目录恢复上次已绑定的5份原始字节，只有全部旧SHA精确匹配才允许作为独立UI候选基线。仍不从旧Native假冒当前源码。
- 既有Native入口已启动重新构建当前输入，并保留前后源码校验；这是安全的本地编译工作，不代表允许将未知schema35安装到VM。最终产物选择仍需确认输入完整性或隔离至精确旧基线。
