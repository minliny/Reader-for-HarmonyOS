# Reader for HarmonyOS Gemini PR 审查规范

## 输出要求
- 全部审查意见和摘要使用**简洁中文**输出。
- 仅报告真实缺陷、性能退化、API 23/26 兼容性隐患、并发/生命周期越界、消息规范违规或安全问题；忽略纯格式化与命名偏好。
- 每条问题必须给出：**精确文件路径 + 行号范围 + 触发调用链 + 最小安全修复建议**。

## HarmonyOS Host 核心红线
1. **Core / Host / UI 所有权边界（`ARCHITECTURE.md`）**：
   - ArkUI 仅展示状态投影并提交用户意图，不得另建第二套书籍、章节、目录或进度事实源。
   - 严禁将“触发动作”或“刷新列表”误报为“持久化成功”；未决原写入必须保留原 `operationId`、身份与代次恢复入口。
2. **API 23 兼容与 API 26 目标守卫（`build-profile.json5`: `compatibleSdkVersion 6.1.0(23)` / `targetSdkVersion 26.0.0`）**：
   - 可选 SysCap Kit（如 `@kit.CoreSpeechKit`、`@kit.ShareKit`、`@kit.UIDesignKit`、`uiMaterial` 等）必须使用 `import lazy` 配合 `canIUse(...)` 守卫，防止在 API 23 或裁剪设备冷启动/进页即崩溃。
   - 所有 API 24/26 专属特性分支除了校验 `distributionOSApiVersion` / `deviceInfo.apiAvailable('26.0.0')` 外，必须包裹 `try/catch` 安全降级，避免中断 `applyNormalAttribute` 或正文排版。
3. **阅读器渲染、手势与模态状态机**：
   - 严控 `LocalReadingExperience.ets`、`ReaderControlPanel.ets`、`MangaReadingSurface.ets`、`ReaderBottomSheet.ets` 中的高频 `@State` / `@Prop` 重绘扩散、无界同步递归分页、离屏快照劫持共享原生段落资源、以及 `HitTestMode` / `rollbackPainting` / `coverVisible` / `pageTurnGestureState` 在取消、退后台、视口退化时的永久锁死。
4. **大目录、图片内存与主线程 I/O**：
   - 千章（1,000–5,000+ 章）目录禁止在 `build()` 内执行 `O(N)` 扫描/深比较、动态编译正则或非虚拟化 `ForEach`。
   - 所有 `PixelMap` / `ImageSource` / `ImagePacker` 必须在 `try/finally` 释放并响应 `onMemoryLevel` / `onBackground` 分级回收；正在挂载的瓦片 lease 不可被 LRU 提前解除。
   - 严禁在 ArkUI 主线程同步调用 `AtomicFile.readFully()` 或在每次图片落盘时无界递归扫描缓存目录。
5. **网络、Cookie、ArkWeb 与异步代际守卫**：
   - 异步回调（进度、计时、封面、TTS、分享、搜索、换源）必须绑定 `session` / `entity` / `generation` / `mounted` / `foreground` 守卫，防止迟到回调串写。
   - HTTP/DNS/Proxy/Cookie 操作需受超时与失败自愈保护；`CookieSessionStore` 持久化不得在热路径阻塞 `cookieHeader()`；`ArkWeb` 子资源拦截不得直接 `stop()` 误杀合法主文档；停止朗读/退出/切漫画时必须停用 `AVSession`。
6. **消息框架与测试红线（`docs/message-ui/FRAMEWORK.md` & `GATE_INDEX.md`）**：
   - 用户可见消息必须归入登记的公共组件并在 `tools/message-entrypoints.json` 登记，禁止页面直接新增 `showToast` / `showAlertDialog`。
   - Node 测试严禁仿真 ArkUI、严禁 stub 被测模块自身方法。
   - `entry/vendor/core-harmony` 来自 Core 上游同步，不得手改脱离 Core 仓；`scripts/core-dependency.json` 必须对应真实存在且匹配的 Core commit。
