# Layer 4 — Unfrozen Bindings 收束计划

> 状态：阻塞（需要真机 hdc 设备证据）
> 来源：`Reader-UI/docs/design/FIGMA_VISUAL_ADMISSION_REGISTRY.json`
> 权威 fileKey：`klhs2jMM4MncaJFqZMfqEK`
> 官方 currentRevision：`2379851596474967636`
> 生成时间：2026-07-26

## 目标

将 28 个 `current-read-unfrozen` binding 冻结为 `current-read-frozen-deliverable`。冻结条件：每个 binding 必须有对应的 device evidence + motion evidence（如涉及动效）。

冻结权限属于 Reader-UI 侧的 `FIGMA_VISUAL_ADMISSION_REGISTRY.json`。HarmonyOS 侧只消费，不写入。

## 阻塞根因

28 个 binding 的 `delivery.blockers` / `delivery.deviceEvidence` / `delivery.motionEvidence` 字段全部为空。这意味着：

1. 结构准入已通过（exact-figma-binding + revision 已验证 + 节点已解析）
2. 视觉契约已对齐（local/harmony targets 已声明）
3. 缺的是**真机渲染证据**——需要在 hdc 设备上运行 HAP，截图/录屏证明每个 binding 的视觉表现与 Figma canonical master 一致

本地无法生成此证据。必须有：
- 一台已解锁的 HarmonyOS 设备（hdc 可连接）
- 当前 release identity 的 HAP 已安装
- 每个 binding 对应路由可导航到
- 截图/录屏工具可用

## 28 个 Unfrozen Bindings 清单

| # | binding id | surfaceType | HarmonyOS target | 页面族 |
|---|-----------|-------------|------------------|--------|
| 1 | bookshelf.page | route-family | MainTabShell.ets / BookshelfComponents.ets#BookshelfShelfSection | Bookshelf |
| 2 | bookshelf.book-card | component | BookshelfComponents.ets#BookCard | Bookshelf |
| 3 | bookshelf.action-sheet | overlay | OverlayHost.ets#book-action-sheet | Bookshelf |
| 4 | bookshelf.multi-select | overlay | OverlayHost.ets#bookshelf-multiselect | Bookshelf |
| 5 | bookshelf.local-import-dialog | overlay | OverlayHost.ets#local-import | Bookshelf |
| 6 | book-detail.page | route-family | BookDetailComponents.ets | Book Detail |
| 7 | book-detail.chapter-row | component | BookDetailComponents.ets#BookChapterList | Book Detail |
| 8 | source-switch.window | overlay | SourceSwitchFlowComponents.ets#SourceSwitchWindow | Source Switch |
| 9 | reader.reading-surface | route-family | ReaderComponents.ets#ReaderBase | Reader |
| 10 | reader.control-home | component | ReaderComponents.ets | Reader |
| 11 | reader.module.directory | component | ReaderComponents.ets | Reader |
| 12 | reader.module.tts | component | ReaderComponents.ets | Reader |
| 13 | reader.module.appearance | component | ReaderComponents.ets | Reader |
| 14 | reader.module.settings | component | ReaderComponents.ets | Reader |
| 15 | reader.quick.auto-page | component | ReaderComponents.ets | Reader |
| 16 | reader.quick.content-search | component | ReaderComponents.ets | Reader |
| 17 | reader.quick.content-replacement | component | ReaderComponents.ets | Reader |
| 18 | reader.full.directory | component | ReaderComponents.ets | Reader |
| 19 | reader.full.tts | component | ReaderComponents.ets | Reader |
| 20 | reader.full.appearance | component | ReaderComponents.ets | Reader |
| 21 | reader.full.settings | component | ReaderComponents.ets | Reader |
| 22 | source-management.final | route-family | (source-management 页面族) | Source Management |
| 23 | webdav.config | route-family | (webdav-config 页面族) | WebDAV Config |
| 24 | sync-backup.page-and-restore-overlay | route-family | (sync-backup 页面族) | Sync Backup |
| 25 | sync-backup.restore-backup-overlay | overlay | (sync-backup overlay) | Sync Backup |
| 26 | search.five-state | route-family | (search 页面族) | Search |
| 27 | rss.page | route-family | (rss 页面族) | RSS |
| 28 | discover.page-route-variants | route-family | (discover 页面族) | Discover |

注：`search.five-state` 的 status 是 `current-read-unfrozen-device-unverified`，其余 27 个是 `current-read-unfrozen`。

## 按页面族分组（便于设备复测）

| 页面族 | binding 数 | 涉及 binding ids |
|--------|-----------|-----------------|
| Reader | 13 | reader.reading-surface, reader.control-home, reader.module.directory/tts/appearance/settings, reader.quick.auto-page/content-search/content-replacement, reader.full.directory/tts/appearance/settings |
| Bookshelf | 5 | bookshelf.page, bookshelf.book-card, bookshelf.action-sheet, bookshelf.multi-select, bookshelf.local-import-dialog |
| Book Detail | 2 | book-detail.page, book-detail.chapter-row |
| Sync Backup | 2 | sync-backup.page-and-restore-overlay, sync-backup.restore-backup-overlay |
| Source Switch | 1 | source-switch.window |
| Source Management | 1 | source-management.final |
| WebDAV Config | 1 | webdav.config |
| Search | 1 | search.five-state |
| RSS | 1 | rss.page |
| Discover | 1 | discover.page-route-variants |

## 冻结流程（设备就绪后执行）

1. **连接设备**：hdc target 可达，设备已解锁
2. **安装 HAP**：当前 release identity 的 HAP 已安装
3. **逐 binding 采集证据**：
   - 导航到 binding 对应路由
   - 截图（静态视觉证据）
   - 录屏（如涉及动效，录制动效证据）
   - 记录设备日志片段（证明渲染路径正确）
4. **写入 Reader-UI registry**：在 `FIGMA_VISUAL_ADMISSION_REGISTRY.json` 对应 record 的 `delivery` 字段填入 deviceEvidence/motionEvidence
5. **更新 deliveryStatus**：从 `current-read-unfrozen` 改为 `current-read-frozen-deliverable`
6. **运行 gate**：`npm run check:reader-ui-consumer` 必须 PASS
7. **提交**：在 Reader-UI 侧提交（HarmonyOS 侧不写入 registry）

## 不可做的

- 不得在 HarmonyOS 侧伪造 device evidence
- 不得用模拟器截图冒充真机证据
- 不得用历史截图冒充当前 release 证据
- 不得跳过 motion evidence（如 binding 涉及动效）
- 不得在 device evidence 缺失时将 status 改为 frozen-deliverable
