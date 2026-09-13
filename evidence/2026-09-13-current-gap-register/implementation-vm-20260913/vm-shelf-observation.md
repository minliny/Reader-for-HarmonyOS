# VM 书架列表观察与代码复核（2026-09-13）

本记录仅维护本次有界观察，不替代工作区问题总账。子 agent 未操作 HDC、VM 或真机。

## 产物与原始证据

- 已安装被观察源码：Harmony `2df5cfa6e3`；manifest run `20260913T125821Z-2df5cfa6-7c0928b6`。
- 签名 HAP SHA256：`a13af1f730f718198f6a82b3f90aea5028f526e8a8430d05446123683150d345`。
- 原始截图：同目录 `reader-control-initial.png`（普通列表）、`reader-control-batch-list.png`（批量列表）。本次直接读取并检查两张原图。
- 下文修复属于该包之后的工作树改动；不能将其本地验证标为上述已安装包的 VM 修复结果。

## 观察 A：缺少作者时行位折叠

触发：列表中的本地书籍作者为空。两张截图中 `ReaderPagingAudit20260911`、`ReaderIndentCRLF20260910` 均只有书名、最新章节、来源与进度三层；有 `Reader test` 作者的 EPUB 保持四层。

已定依据：`docs/READER_REPAIR_SPEC.md` §5.1 要求书名、作者、最新章节、来源与进度固定四行，原字体、字号、字重、行高保持。历史 `evidence/2026-09-12-new-ui-audit/ISSUES.md` N06/N08 已明确四行新要求优先于 Figma List `493:191` 的旧三层示例，并记录作者 12vp / 15vp、信息区至少 76vp。该目录记录的 Make 入口没有书架页面，不能虚构 Make 空作者行为。

代码定位：普通和批量均调用 `ShelfBookListDetails`。作者使用 `Text(this.book.author)` 并声明 `lineHeight(15)`，没有独立最小布局高度；空文本不产生一行字形，真实 ArkUI 的空 Text 高度折叠，下面两行随 Column 上移。容器 `height(76)` 只约束整块高度，不能保持每个子行的位置。

结论：明确违反现有四行约束，无需新增产品决策。最小修复为作者 Text 增加 `constraintSize({ minHeight: 15 })`，保留空内容，不伪造“未知作者”等文案，不改文字样式或其余几何。对真实 SDK 编译后的 Builder 闭包检查空作者、有作者及状态重放均输出 15vp 最小布局高度；该检查证明生产布局约束，不冒充原生像素验收。后续新 manifest 的 VM 复验仍由 root 执行。

## 观察 B：本地来源标签

同一已安装包中 `sourceId=local, kind=local` 显示“本地 local”；`sourceId=local, kind=EPUB` 显示“本地 EPUB”。这是 `ShelfBookPresentation.source()` 的本地分支直接拼接格式字段，未读取远程 URL，也不是 Core sourceName 丢失造成的回退。

当前合同 §5.1 只规定“本地导入用本地来源语义”，并未指定本地标签必须只显示“本地书籍”或禁止格式后缀。历史 N07 曾建议“本地书籍”，但它是旧提案且还包括后来已废弃的 sourceId 回退规则；不能将整条旧提案直接当成当前强制合同。Figma 旧示例“网络书 / 已缓存”及已存 Make 也没有本地格式显示约束。

结论：“本地 local”重复且带内部格式词，但现有证据不足以认定为违反已定样式；“本地 EPUB”明确具有本地来源语义。本任务不修改这两种显示，也不新增需要用户决策的阻塞项。远程书源名称禁止 URL/sourceId 的既定合同保持不变。

## 修复与验证

- 原始 Figma 导出 `evidence/2026-09-12-new-ui-audit/493-196.yaml` 保留 `493:191` 的作者节点 `1494:47` 与 `style_60KUCV`，确认为原字号 12vp、行高 15vp；新四行组织来自用户要求，不来自另造 Figma 端点。
- 修改 `ShelfBookListDetails.ets` 一处：作者添加 `constraintSize({ minHeight: 15 })`。普通与批量共用，无重复分支。
- `tools/test-bookshelf-view-and-menu.mjs` 增加真实 SDK Builder 闭包回归：初始空作者、有作者、再次空作者的重放均核验布局最小高度和保留原字体、字号、行高。
- 先运行未修复生产代码，新断言以 `undefined !== 15` 失败，原始日志 `reader-shelf-empty-author-before.log`；加入约束后同一命令通过，日志 `reader-shelf-empty-author-after.log`。测试顺带执行既有 import 生命周期、模式持久化及书架菜单回归。
- `git diff --check` 对本次两项代码/测试改动通过。未提交；未构建或安装后续 HAP；上述两张截图仅证明修复前现象。
