# 图标修复状态

2026-10-20。用户授权修复初次审计问题，并选择 TTS **C：折角＋单竖线，加大间距**。本表记录当前源码处理；构建、安装和原生像素证据在完成后补记，不由源码修改推导通过。

| 原审计项 | 当前处理 |
|---|---|
| ICON-01、03 | 书架更多菜单下载/更新改用该菜单的日夜普通文字色、统一 1.75@24 线重；下载列表状态灰保留。 |
| ICON-02 | 设置下载入口改为设置导航族的日夜色；阅读目录标记保留。 |
| ICON-04 | TTS 停止增加现有 clay 主题的夜色资源。 |
| ICON-05 | 公共返回、漫画上一页/下一页补动作名称、按钮角色及焦点准入；返回和翻页业务回调保持。 |
| RULE-01 | 底部操作图定义有限 `ReaderActionIconKind` 和日夜资源映射，四组实际调用者使用同一前景配方；菜单/多色/内容图继续按自身语义取图。未将任意 Resource 全局强行染色。 |
| RULE-02 | 本次改动家族沿现有主题 role 生成具体日夜 SVG；其余历史近似色没有全局替换。 |
| RULE-03、04 | 书签与漫画图标/按下反馈跟随实际阅读纸面，公共按钮显式 scheme 覆盖 auto。 |
| RULE-05 | 书架多选字符勾改 SVG，选中绿色；移除图标/文字采用危险色及夜色。 |
| RULE-06 | 漫画独立目录排序改用本漫画强调色，保留原排序动作和方向。 |
| RULE-07 | 公共图标、书源新增、漫画排序保留视觉尺寸，补至少 44vp 响应范围和按钮语义；公共图标 disabled 为 .45。不同家族不强制同一视觉大小。原生超出父边界的命中效果未由源码证明。 |
| RULE-08 | 下载 Checkbox 显式补主题绿色、勾选前景及未选边框；回调不变。原生实际对比度仍属设备绘制证据。 |
| RULE-09 | 设置恢复默认的图、字、底采用已有危险色族，新增日夜资源；l0 关闭的 RSS 不冒充当前可见问题。 |
| RULE-10 | 换源等待采用原生 LoadingProgress，保留 mounted/active/foreground/reduceMotion 准入；不再自绘环形动画。 |
| RULE-11 | 阅读目录工具按钮删掉重复 Image，只保留已有可靠的显式资源分支，不改动作。 |
| RULE-12 | 快捷 TTS 定时仍循环预设，图由下拉箭头改循环图；完整态继续使用原选择列表。 |
| RULE-13 | 初次审计已记录历史文档与当前实现差异；本次修复说明以实际组件和当前有限配方为准，不把旧文档视作验收。 |
| 追加 TTS 选择 | C 应用于实际引用的 previous/next、quick 及旧版对应资源；保留原 intrinsic 大小、颜色和业务动作。准确清单见资源修复记录。 |

详细改动：[资源及配方](repairs-resources.md)、[阅读/漫画/换源](repairs-reading.md)、[其他页面](repairs-pages.md)。

## 精度修复

原参考图中 22vp 图标在 3.5 倍密度下已占 77×77 物理像素，问题不能归因为 SVG 的 24/48 viewBox。原图四个操作图只有前景/背景两色；同图的文字与搜索图有多级边缘颜色。旧矩阵把 0–255 RGB 当作归一化偏移，导致输出饱和。底部面板现移除运行时 ColorFilter，直接显示有限预着色 SVG，并使用 Contain；保持 22vp 图标和 36vp 图标底。

本次没有添加不支持 SVG 的 sourceSize/interpolation 开关，也没有将所有资源栅格化成 2x/4x 缓存。新增文本 SVG 仅增加有限包体；不存在统一放大位图导致的 4/16 倍像素缓存策略。追加 VM 原生截图已确认当前四个书籍操作图标存在抗锯齿过渡且前景色正确；具体尺寸、像素统计和跨设备证据边界见文末。

## 本次检查清单

1. `.reader-artifacts/icon-repair-20261020/selected-components.mjs`：仅实际 ReaderActionMenuSurface、ReaderIconButton、SourceSwitchSpinner，加 ReaderSheetActionList 的实际 dispatch 准入联测。嵌套为官方 ETS 编译/组件构造、V1 属性探针、有限 spec/DTO 与实际按压修饰器；不调用其他业务测试或套件。保护移除染色后的资源、禁用/退场/单次提交和原生动画准入，均是本次修改直接风险。详见[有限验证](repair-verification.md)。
2. `node scripts/deveco-build.mjs`：开发增量编译打包，嵌套 Hvigor assembleHap 和项目原生签名 hook。只保留实际输入/工具、Native/SDK 配套、指定证书/Profile 与包字节核验；依据是生成可安装修复包，不执行合同套件。
3. 开发安装：仅本次成功构建且已验签的 signed 输出，核对本轮用户指定的精确目标、启动稳定、已安装身份与覆盖更新身份；`install -r` 保数据，不卸载、不清数据。本次先完成用户提供的无线真机安装；用户随后明确改为现有 VM 安装截图，VM 仅重新执行相应目标及签名必要核验。这些条件只服务于安装，不触发业务或全量门禁。

所有未选业务/完整门禁均为 NOT_RUN，不借用旧 PASS。源码、窄范围探针、开发编译、安装启动、原生像素与用户验收分层记录。

## 最小原生取证范围

已从代码侧核对原 PNG 的物理尺寸/边缘颜色、SVG 几何、旧 ColorFilter 矩阵及官方 Image API，并完成直接 SVG 修复。剩余问题只有本机当前 HarmonyOS SVG 绘制链是否产生平滑边缘，无法用源码或 Chromium 像素证明。若设备已连接且解锁，只打开一张书籍操作面板，保留单张原始 PNG 与对应 bounds，分析同一图标的边缘颜色；不遍历其他业务或重复复测。不自动解锁，不把安装/启动视为像素或交互验收。

## 当前证据

- 源码修复：已完成；TTS C 已覆盖 12 个既有日夜文件，路径显式 fill=none，保持描边折角与单竖线。
- 有限组件验证：16 项 PASS，1.73 秒；一次验证脚本取记录位置错误已记录，修正忽略脚本后重跑同一入口，生产未因此改动。
- 重复补审及清理：补审快照为 456 SVG、34 组字节重复；随后按[唯一清理映射](duplicate-cleanup-map.json)迁移 14 文件的 35 处消费，实际删除 27 SVG，456→429，对应配方/来源/主题登记同步移除。不同主题角色恰好同色的项目保留并逐项说明。筛选漏斗/滑杆没有替换，见[两套现状对照](filter-options/index.html)。
- 本次开发编译/验签：PASS，2026-10-20 00:58:53（上海）完成，70.333秒；Native最终生产构建与同步已完成，host_probe/sdk_smoke/Core/Harmony套件均未运行。指定证书 `minliny_HarmonyOS` 验签通过，包名 `io.reader.minliny`，HAP SHA256 `5a57265d37af3feec034bd924523b9ad43057156398d1e1cc85bdb61d8bbe776`。Host构建输入前后指纹相同 `a68ff1b48cbb4e24053fb522faba74974ac05c6176b91649831a09e7fdc8aa5d`。
- 本次物理机安装/启动：PASS。2026-10-20 01:05:57（上海），按用户提供的无线调试端点对真机 `ab6316d07862` 覆盖安装并启动，签名/Profile及已安装身份匹配，保留数据；回执 `.reader-artifacts/icon-repair-20261020/development-physical-install.json`。原生像素、用户验收仍为OPEN。
- 不创建不可变交付 manifest，不声称发布/整体验收通过。

## 追加日夜与可读性补修

清理后 429 SVG 的只读覆盖检查发现 21 个基础图无独立 night、0 个孤儿 night；其中确定的当前缺口为完整替换「新增规则」白图文配夜间浅金底。另外，未配置在线 TTS「立即配置」箭头借用普通灰图，日夜对比均偏低。其余固定反白/纸面 primitive、保留未用/关闭功能逐项见[覆盖表](night-coverage.md)，小尺寸/形状占位及未挂载8×4分支风险见[可读性报告](readability.md)。

两项已做最小补修：新增规则沿原 specific 文字 role 保留日白、夜色改 `#302B25`，加号新增同前景 night；未配置 TTS 胶囊新增与文字同色的日 `#FFFAF4` / 夜 `#302B25` chevron，已配置分支仍用原资源。只增 3 SVG，429→432，不变更几何、尺寸、布局或动作。源色对比：新增规则夜约1.83→7.65；未配置TTS箭头日1.62→6.42、夜1.20→7.65。它们是颜色计算，不是真机合成像素证明。

## 构建问题记录

首轮开发打包在 2026-10-20 00:39:35（上海）失败，实际耗时 223.454 秒，未生成可选修复 HAP。日志及源码快照位于 `.reader-artifacts/icon-repair-20261020/`。Rust release 已完成；随后 CMake 报现有 `target/harmony-napi/arm64-v8a/CMakeCache.txt` 来自改名前 `Reader-Core-Native`，与当前 `Reader-Core` 源目录不匹配。该问题是现有构建缓存路径失效，尚未进入本次 ArkTS 编译；未运行 Core/Harmony 测试。

最小恢复只将失效的 CMake cache/build.ninja/CMakeFiles 保留至忽略证据目录，沿原构建入口重新配置该目录，保留已完成 Rust 编译和 build identity。不得改写旧绝对路径伪装匹配，不删除 Native/应用数据，不扩为全量测试。恢复与后续结果另记。

恢复实际入口是 Core `bash scripts/build-harmony-napi.sh`（仅默认 Cargo 构建＋CMake/Ninja 配套，host_probe/sdk_smoke 均 NOT_RUN）→ Host `node scripts/hap-pipeline.mjs sync-native`（仅生产输入字节/身份与同步）→ 同一 DevEco 开发构建。原因是首次失败已经写入新的 Rust identity、尚未生成新 NAPI，必须完成同一次配套，不能拿旧 SO 配新 identity；没有调用测试入口。旧 CMake 配置、Ninja 中间物和 SO 已完整移入 `.reader-artifacts/icon-repair-20261020/cmake-cache-before-rename/`，Rust 产物和 identity 保留，第一轮失败日志另存 `attempt1-*`。

第二轮开发构建在 00:50:26（上海）因输入漂移失败，耗时209.225秒，仍未进入ArkTS打包。已记录 `attempt2-*` 及精确漂移清单：`scripts/check-harmony-napi-host.sh`、`scripts/lib/gate-receipt.mjs`、`scripts/lib/core-gate-selection.mjs`。本任务没有编辑或执行这三项；并行任务在Native构建期间修改了纳入Core内容指纹的这些脚本，结束复验拒绝。没有放宽身份或借旧SO安装；后续只在输入稳定后重新完成既有Native生产构建（无host_probe/sdk_smoke）和同步，再做开发打包，不补跑任何测试。稳定观察写 `core-input-stability-observation.json`。

## USB连接问题记录

用户两次确认手机始终连接。安装前HDC报告USB Offline，本任务将此等同于物理断开并反复要求重连，判断不准确。实际只读检查证明macOS IOKit仍枚举到目标 `b1f20b88963d` 的 HDC Device（VID4817/PID4353），HDC客户端/服务同为3.2.0d；日志持续出现Darwin USB transfer `device not responding (0xe00002ed)` 与 `libusb_get_string_descriptor_ascii failed 0-1`。因此确认的是USB设备枚举存在但描述符/调试传输失败，底层故障点尚不能仅凭这些日志归因于线缆、手机、Chrome或ChatGPT。

已在共享HDC lease空闲时，对本机HDC服务做一次受控重建，未对手机/VM执行重启、安装、清数据或卸载。VM原TCP传输仍Connected；手机调试会话未恢复，因此没有继续应用层重试。保留 `.reader-artifacts/icon-repair-20261020/usb-transport-diagnosis.json`；下一最小外部动作是手机端关闭再开启一次USB调试以重新发布接口，仍保持原连接。连接恢复后使用本次已验签包保数据安装，不重编。

用户随后重新开启USB调试并提供无线端点，`tconn` 成功。该同一已验签HAP经精确无线目标、启动稳定和保数据身份核验后安装/启动成功，未重编。读取了当前书架UI层级，随后准备按观测到的首本书卡片bounds长按并截单张面板图时，连接准入发现该无线目标也变为Offline；长按与截图均未发出，已停止设备侧应用操作。USB和无线传输的底层异常尚未完全定位，不将其归因给物理拔线或Reader。当前没有本次HAP的图标边缘像素证据，移除染色后的抗锯齿恢复仍为OPEN。

用户追问操作因果后核对了共享HDC命令回执与本机HDC日志：01:05:57安装/启动成功；01:06:08完成`uitest dumpLayout`；01:06:12.124完成`file recv`取回JSON，随即仅退出本地探针并释放文件锁；01:06:19.159，目标对应TCP会话在`tcp.cpp:102`报告`ReadStream < 0 end of file`，之后由HDC清理会话并标记faultInfo=end of file。01:06:12至01:06:39之间本任务没有发出其它HDC命令；01:06:39只有连接列表检查，长按/截图在准入之前停止。唯一一次本机HDC重建在01:02:18，早于01:05:21无线连接。日志支持TCP流EOF这个直接触发，但没有手机端同期日志，不能证明`file recv`、探针退出、系统省电或任何特定操作者是底层原因。用户告知无线恢复后，本轮只做连接查询，确认Connected，未进行新的手机界面操作。

## 追加 VM 原生精度验证

用户在手机自动锁屏后明确改为“在 VM 上安装截取”，真机操作随即停止。2026-10-20 01:24:46（上海）在本轮发现且正在运行的 VM `6460677a198b` 上，按当前实例 Emulator.log、完整启动、稳定 SceneBoard 和签名/Profile身份准入，保数据覆盖安装并启动成功。使用同一份 SHA256 `5a57265d37af3feec034bd924523b9ad43057156398d1e1cc85bdb61d8bbe776` 开发包；没有重新构建、启动/重置 VM 或执行测试套件。

长按当前书架首本书后，原生层级实际出现“书籍操作 / 多选 / 书籍信息 / 编辑分组 / 移除书架”，截图与层级相互确认打开成功。原始 PNG 为 1280×2832，四个 Image bounds 均77×77。check/info/folder/trash分别为55/205/95/109种像素颜色，其中符合前景/背景混合的边缘过渡色为53/203/93/106种，对应过渡像素182/469/320/551个；纯前景为预期纸色`#FFFCF8`，背景为`#2E4A3E`/危险色`#A53D31`。本次VM这四图的原生抗锯齿与前景颜色观察通过，未通过放大图标或位图缓存换取清晰度。

旧真机参考同样77×77的四图各只有2色、0过渡色、纯前景为饱和白`#FFFFFF`。新旧属于不同目标，不能据此将AA变化唯一归因于ColorFilter，也不证明全部图标、夜间或真机像素验收。此前真机尝试只拿到书架截图，随后系统锁屏，没有有效操作面板像素。

证据位于`.reader-artifacts/icon-repair-20261020/`：`development-vm-install.json`、`reader-control-vm-icon-panel.png`、同名JSON、`native-precision-observation.json`、`vm-panel-pixels/`。完整门禁仍为NOT_RUN，用户验收OPEN。
