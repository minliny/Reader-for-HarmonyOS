# 漫画目录 Demo 落地记录

本次按用户当前 `http://127.0.0.1:4199/?view=full&scenario=hierarchy` Demo 落地，仅在独立 Host worktree `codex/manga-directory-native-20261006` 修改。基线 Host `e16f41addd7e42b574eaa50370fe2e612ed442fc`、Core `2166576ff5f2091b1d921c9a018cd7c7b536fdd4`、UI `8e8e7bc530d602bef2f0be61d29f197efaa1b172`。主工作区并行修改没有带入。

参考为 `/private/tmp/reader-complex-directory-history-20261006` 恢复 Demo 的当前源码，含本会话已确认的密度优化：数字/分篇 44px 单行格、当前格角标，命名章节 58px、组 48px。恢复包的 `RECOVERY-MANIFEST.json` 说明历史基础 CSS 哈希差异和缺少的 named 真实样本；它不提供当前原生应用视觉验收证据。

范围覆盖完整目录的 Core v2 分页 renderer、详情当前附近预览、阅读快捷目录及旧平台回退 renderer。继续使用系统 ArkUI Grid/List/LazyForEach 和既有平台 LRU；新增模型只是 Reader 展示适配。分组、可读性、身份、层级由 Core 事实决定，标题样式仅识别纯数字、数字加上/中/下以决定排版。没有修改解析器、阅读进度或源数据身份。

## 问题账

| 编号 | 现象与触发条件 | 代码定位与处理 | 证据边界 |
| --- | --- | --- | --- |
| MD-01 | 普通数字章节预留“正在读”第二行，非当前格空 | 展示层统一 44px，当前状态改角标 | 当前 Demo 浏览器已查；原生代码及 SDK 回归待记录 |
| MD-02 | 完整目录 v2 仍全部使用列表，缺数字/分篇网格 | 分页 Grid 保 Core visibleIndex、nodeId、原目标 proof；只为驻留页计算 span | 设备布局验收待完成 |
| MD-03 | 旧展示模型只把不可读父节点压入祖先；显式更深 level 的可读父丢失路径/折叠 | `MangaDirectoryPresentation` 识别显式子层级，保留可读父 canonical index，分别处理阅读与展开 | 模型/实际 SDK 回归待记录 |
| MD-04 | 快捷目录重复整本列表及搜索工具，未按当前附近展示 | bounded Core 节点投影及回退 nearby，保同话分篇；上一章/完整目录/下一章与当前位置 | 当前 artifact/设备视觉尚无证据 |
| MD-05 | Grid 初版数字格缺下载入口；快捷跨卷重号只有无障碍路径，没有可见路径 | 保留独立下载按钮；快捷插入只读路径展示槽，无 target/proof/点击身份，映射仍指向原 Core 节点 | 新真实 SDK 场景验证，原生像素尚待验收 |
| MD-06 | 拖动期间页先入共用 LRU，尚未发布的 placeholder 被当成真实行，可能继承错误像素位置 | 缓存与已发布页状态分开，仅追加有界数字页标记；停止后按真实 Core 节点恢复，旧 placeholder 不复用像素比例 | 代码侧审查定位，补 deferred cache→stop 回归 |
| MD-07 | 完整页面仍是旧卡片工具区，不符合 Demo 书名/搜索/定位/排序布局 | 对齐全页工具尺寸，复用 ReaderSearchField 的漫画展示 variant | SDK props/布局预算验证；设备视觉待验收 |
| MD-08 | 本机 SDK 严格类型审查发现快捷页数组缺接口上下文，空格回调使用 unknown，nearby 辅助器使用嵌套函数声明 | 补 ReaderDirectoryLoadedPage[] 类型；空格改明确 number[] 循环；辅助器改显式类型箭头函数，保原行为 | Grid、quick、共享行及模型回归分别记录；规范编译待最终记录 |
| SETUP-01 | Host worktree checkout 的 post-checkout LFS hook 报本机缺 git-lfs | checkout 已建立且干净；检查资源未留下 LFS pointer，无全局 hook 修改 | 新工作区编译还需独立通过 |

## 验证与交付

代码、契约测试、ArkTS 编译、签名 HAP、VM/设备视觉与用户验收分别记录。本次先完成代码和本地产物验证，设备视觉另行验证。原生构建采用工作区规范 `hap-pipeline.mjs`，只使用用户指定的 `minliny_HarmonyOS` 和 `io.reader.minliny` Profile。

Core/UI 配套检出保持独立，Core Native 从此检出重建并以规范 sync-native 校验来源。参考已冻结至独立工作区 `evidence/manga-directory-20261006/reference/`，`reference-inputs.json` 给出当前 Demo 源码 SHA256。

- Core Native 干净检出重建通过，真实 host NAPI gate 及 Harmony SDK smoke 69 pass / 0 fail（522 assertions）；Native SHA256 `511b3415b1f16a984d9bc1d37539a76951cf77f09eaaf168ad6a48438aa9c117`。
- 新模型、共享行、quick toolbar，以及旧层级/下载/fallback/sheet/surface SDK 探针已通过当前对应源码回归；全量门禁待最终冻结后由规范构建执行。
- 复核发现并修复手机短屏预算：顶部标题/toolbar/current footer/底padding共215vp，目录可滚动区按剩余预算计算，避免footer被clip。
- 同步 Native 首次遇到全局 HAP 锁占用（`source-switch-native-20261006`，有效 owner），保留原锁并等待；锁释放后规范 `sync-native` 通过，SDK/SO 来源校验和原子同步已完成。
- 手机完整目录、详情附近预览和阅读快捷目录共享数字/分篇44vp、命名58vp、组48vp规则。平板持久侧栏的 catalog 模式保留既有可读行最小48vp、组44vp布局。Quick 命名章节前2/后3，数字/分篇前4/后7，边界保留同父同话分篇。v2 只检查当前附近最多64个 Core visible slots，可插入最多同量的只读上下文槽（总计最多128个展示槽），无额外目录遍历；路径从已发布 Core 祖先节点获取，未知祖先只保留已有事实。
- 全目录继续保留256节点/页和12页进程共享 LRU。跨页 run 在页面边界换行；未加载页的默认 Grid 几何与实际布局差异通过 Core index/真实 anchor 恢复，设备滚动像素及运动仍待验证。
- 完整页面字体、输入和工具尺寸对齐 Demo；原生保留固定工具区并按实测高度避让，Demo 的同一区域随正文滚动。短屏书名限制单行，避免工具遮掉完整章节格。详见 [完整目录工具区记录](MANGA_DIRECTORY_FULL_CHROME_20261006.md)。
- 首轮654项完整门禁未通过：45项实际失败、52项超时。已补新共享组件的精确架构登记、限定漫画字体 carrier 迁移及唯一公共搜索字体 role；原93条业务预算、7条历史迁移和非本次清单保持不变，负控继续拒绝99字号与错误导入。旧 SDK 探针现挂载真实共享子组件，小说目录不计算漫画布局；独立 Core CLI 已从干净源码补建，相关集成连锁回归通过。超时记录保留，未放宽期限；最终完整门禁用2个worker重跑。详细首次记录在独立工作区 `evidence/manga-directory-20261006/gate-issues.json`。

第二轮完整门禁 649/654 通过，保留 5 项失败记录：旧 Page 测试补齐漫画类型后完整回归通过，其余进程/异步等待失败保留原期限。单进程复跑中，前 118 项已通过，包括先前超时的书架持久写回、FIFO 负控及 runner 时限测试；因 MD-08 静态审查而安全停止自己的 runner，规范控制器正常释放锁。完成最小声明修复及对应 SDK/模型回归后，重新冻结并从头执行完整门禁，不复用中断轮结果。

最终全量检查与签名产物结果写入独立工作区 `evidence/manga-directory-20261006/delivery-result.json`。构建冻结后不再改本源码记录，以便产物与当前源码指纹继续一致。
