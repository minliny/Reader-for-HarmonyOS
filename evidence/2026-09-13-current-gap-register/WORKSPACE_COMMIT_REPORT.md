# 工作区整理与提交记录

本轮共24项本地提交：Harmony 20项（16项既有代码/测试/工具、3项历史证据、1项本轮方案/审计），Core 4项（2项修复/回归、1项streaming WIP、1项过时动效文档更正）。没有推送。最后一项文档提交即包含本文件的提交，避免在提交内容中自引用它的hash。

7项明确标为WIP，保留当前实现和已知缺陷。其余提交也只继承各自局部证据；整理不是全量修复或设备验收。原68个Harmony已修改文件逐字节未变，Core生产字节保留见专项回执。

## Harmony

| 提交 | 内容 |
|---|---|
| `d23cd66c` | fix(hdc): serialize existing device tooling through a shared-server lease |
| `2f0bfece` | fix(tts): defer platform audio-session manager creation |
| `62f99d35` | fix(reader): preserve held drag displacement when page readiness arrives |
| `b5998f35` | feat(import): expose existing MOBI and AZW format admission |
| `bce9c46b` | fix(bookshelf): persist view mode and project source metadata |
| `19c700b7` | wip(bookshelf): record current action sheet and management routing |
| `9d9db72b` | fix(import): separate file selection and size result lists from batch count |
| `4d78599f` | fix(search): retain loading actor and add history collapse |
| `b0eaef9c` | wip(toc): preserve shelf-hit reuse and empty-catalog diagnostic fields |
| `ba9e25a0` | feat(tts): wire background and awake preferences into existing controls |
| `390e0954` | fix(controls): restore settings outlines and route collapse input |
| `ba9ce0c9` | wip(brightness): preserve current drag-time window update attempt |
| `f9425b9b` | fix(reader): pass exact chrome ink and reserve control layout space |
| `45d5b60b` | wip(reader): record current top-more bookmark action |
| `3ec045c9` | wip(capsule): record current snapshot handoff and reveal overlap |
| `3ab102c6` | wip(theme): preserve inactive control palette scaffold |
| `997318ea` | docs(evidence): archive prior control and input captures |
| `1fc6b187` | docs(evidence): preserve previous UI comparison records |
| `6a0725e2` | docs(evidence): archive previous VM retry provenance |
| 本文件所在提交 | docs(reader): freeze audited repair specification and decision provenance |

## Core

| 提交 | 内容 |
|---|---|
| `b69c86e4b` | test(local-book): cover metadata fallback through format dispatch |
| `c42af9a1f` | fix(local-book): normalize UTF-8 BOM before EPUB XML parsing |
| `5aac38327` | wip(local-book): preserve streaming XHTML optimization for repair |
| `9ccb0c74c` | docs(motion): supersede obsolete capsule timing and handoff claims |

## 验证与保留边界

- Harmony现有198组本地检查通过；两类TOC、四类页面/配置/亮度探针及四个Core阈值失败已经记录，尚未在本轮修复。
- Core安全前置独立252项通过；streaming WIP常规253项通过，新增4项阈值探针失败，因此不是可交付候选。
- 根目录不是Git仓库。根总账和审计记录的本轮原文快照随本提交归档；后续实时状态仍只维护根总账，快照不成为第二份待办。
- 其他根层仓库/工作树均核对为干净；没有移动、删除或改写。最终文档提交前只有本轮方案和审计目录待提交，提交后另行核对所有Git工作树。
- 详细hash、提交正文、文件清单、字节校验、根文档快照与所有仓库身份见 [workspace-commit-receipt.json](workspace-commit-receipt.json)。
- 完整合同见 [READER_REPAIR_SPEC.md](../../docs/READER_REPAIR_SPEC.md)，新建议和证据不足的边界单列于§13。
