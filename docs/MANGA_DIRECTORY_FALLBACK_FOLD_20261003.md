# 漫画目录 fallback 明确分组展示修复

## 发现、根因与范围

2026-10-03 用户指出目录内部样式与自生成 demo 不一致。目录 owner 首轮修复后，fallback 已按明确 `level` / `navigable` 事实显示 48vp 分组行、600 字重与完整目录可读数量，但分组行仍因 `navigable === false` 被禁用，且没有下箭头、折叠展示状态或点击路径。该缺口来自 demo 的分组交互没有完整落实，不能把补全行高/文字视为目录内部 UI 已对齐。

本轮只接管 `MangaReadingDirectoryFallback.ets` 与原有 SDK fallback 测试。`MangaReadingSurface.ets` 保持冻结，未构建、未操作 VM、未提交。

复用审计：`ReaderDirectoryProjection.ts` 只提供既有搜索/排序，`ReaderDirectoryHierarchy.ts` 只提供级别/缩进/可访问性；没有现成 collapse projection。`LocalBookDetail.ets` 已有不可变 `collapsedGroups` 展示状态模式，但其“任意禁用行就是组”的可见列表规则不能用于保留未知事实的漫画目录。这里沿用该状态模式，并直接使用 fallback 已计算的明确分组祖先关系；排序/搜索仍交给既有 projector，箭头及 180ms ArkUI 属性动画与 `ReaderDirectoryNavigationList.ets` 完全复用，不新增通用目录引擎或标题猜测规则。

## 已落实的展示行为

- 已证明的 group 行可点击，16vp 日/夜下箭头，展开 0 度、折叠 -90 度，原生属性动画请求 180ms `ease`；行高 48vp、字重 600 与 full-catalog count 保留。
- 分组点击通过原有完整目录快照、source/book identity、当前可见行与 exact immutable entry 校验，再改变展示状态；绝不调用选章回调。
- 嵌套折叠只隐藏该组的已证明后代。展开外组保留子组折叠偏好，未知层级行不推断归属。
- 搜索始终查询完整 admitted canonical TOC，仍能找到折叠内的章节；父标题和可读数量始终来自完整目录；从不重写 chapter index。
- 定位当前章节只展开其已证明的祖先分组，再按当前展示 rank 发起现有 12vp/smooth 定位。
- changed source/book、复用 index 但改变 exact group entry、失去 group facts 时清除旧折叠状态；未挂载/数据尚未被 Watch 准入/旧回调/已隐藏章节均不能取得操作权限。
- `navigable:false` 但缺少合法整数层级及后续更深层级事实的行，保留普通禁用行；不根据“卷”字造组，不显示“整卷可读”。

## 本地及 SDK 证据

命令：`node --experimental-strip-types tools/test-manga-reading-directory-fallback.mjs`，退出 0。日志：`evidence/2026-10-03-manga-reader-sheets/sdk-fallback-fold-green.log`。

生产方法测试覆盖 681 条稀疏 canonical TOC、真实 v2 unavailable 路径、嵌套折叠、展开偏好、旧 source/data/row 回调、搜索/排序/计数、定位展开与 canonical 选章。SDK 测试使用安装 SDK 的未修改 ETS lowerer 及 `ObservedPropertyObjectPU` / `ObservedObject` 属性/代理方法，订阅/依赖投递与 native attribute I/O 边界有探针；保留同一 List 与 Image actor，验证点击后 0/-90/0 原生 rotate 属性请求、完整数量、可访问性文本与操作守卫。

三个明确负控都必须失败：移除 `collapsedGroups` 的 `@State` 会使既有箭头 actor 不更新；移除 180ms 属性动画请求会被拒绝；保持 group disabled 会被拒绝。目录 owner 独立重新运行本测试通过；其 `test-manga-directory-demo-parity-sdk.mjs` 最新十个独立负控也通过。

新增测试首次运行暴露了测试断言边界：安装 SDK 的 observed array 是 Proxy，直接将它与普通 `[]` 作 `deepStrictEqual` 导致断言失败，值均为空。只将该观测值 `Array.from` 后比较；没有因该失败改生产代码。

| 冻结文件或证据 | SHA-256 |
| --- | --- |
| `MangaReadingDirectoryFallback.ets`，2026-10-03 17:57:07 | `b2a220f511ec341db7f208031addb9077859db31d33971174a0d69bd2ceeaa99` |
| `tools/test-manga-reading-directory-fallback.mjs`，2026-10-03 17:58:48 | `cd78c0cb3e18b56ded6dc0ea60a373a547a126b321b9a598209916197f071c20` |
| `sdk-fallback-fold-green.log` | `ca981d75044a17d0443a83ccf9eed50df959a56752821b1f90e655ef4cc269bb` |
| 安装 SDK property/proxy 提取片段 | `6140bfa5cf6705ddee40349c2e082083778a920f0ff870cc51dccb0f030ccbd5` |

证据层：源码修复和本地 SDK 属性请求已通过；本轮没有 HAP、VM 或 compositor 像素证据。180ms 请求通过不能替代实际帧时序、屏幕画面或用户验收。
# 后续静态字体与目录布局证据（2026-10-03 18:58）

本轮保留以上折叠／完整树计数／canonical安全行为，追加精确静态Regular／550／600 family与同一native actor实时切换。UI同actor正控覆盖phone58→wide50→catalog普通48/组44→narrow→phone，搜索left10、顶线随真实投影首项移动、empty顶线、catalog无顶线及尾部18；wide初次定位7、explicit locate12，未知事实仍不制造分组。`tools/test-manga-reading-directory-fallback.mjs`及其Prop/face/缩进负控退出0。

本次源SHA `67980a6895eaf34454fcac84fab7e889558c81b5c4d6ed2fa7b1ecb1ff7ed929`，测试SHA `726c8ef27a7c8161abc1d32cc78b545997a5bbc4f32ff8a2f81c1dc6d20a9161`。完整9项本地回归输出见 `evidence/2026-10-03-manga-reader-sheets-r3/sdk-sheet-static-final.log`。此前VF探针、旧冻结SHA和R2 VM字形失败保留为历史证据，均不能替代本次target字形／scroll／compositor验收；没有构建、VM操作或提交。
