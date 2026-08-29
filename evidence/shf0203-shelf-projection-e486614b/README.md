# SHF-02/03 书架投影 + 前台更新队列 — 证据包

- 日期: 2026-08-30
- 分支: `feat/shf02-03-shelf-projection`（base = main a3e422c）
- HAP: entry-default-signed.hap
  SHA-256 = `e486614ba65ff51cfa55c3ee7e3456514d91a8c0a7ac52b606cefd0d0f48483f`
- 安装: `hdc -t 127.0.0.1:5555 install -r`（保留既有数据），启动 `aa start -a EntryAbility -b io.reader.harmonyos` 正常
- VM: 127.0.0.1:5555，规范锁 `/private/tmp/reader-vm-locks/reader-harmony-vm-127.0.0.1-5555.lock`

## 审计依据

全局能力审计（AUDIT_READER_PRODUCT_CAPABILITY_STAGE_REFRESH_2026-08-30.md）P1 队列 #2：

- **SHF-02 书架排序/分组投影**：默认排序 = 最近阅读（lastReadAt 降序），主书架分组筛选 chips。无 Figma 帧 → 已批准产品扩展，wired-intent 断言取代旧守卫。
- **SHF-03 前台书架全量更新队列**：用户手动的书架批量检查更新，并发 2，无新增后台调度；与后台 sweep 互斥。

## 代码变更

| 文件 | 变更 |
| --- | --- |
| BookshelfFlowGateway.ts | `load()` 以 `{ sortBy: 'lastReadAt', sortDirection: 'descending' }` 调 `bookshelf.list`（与 loadContinueReading 同参，生产已验证） |
| BookshelfPage.ets | 死筛选按钮接活：toggle 筛选行（全部 + 分组 chips + 检查更新 chip）；`visibleBooks()`/`groupNames()`/`bookRows()` 投影；更新进度 `检查中 n/m` + 运行中禁用 |
| BookshelfMoreMenu.ets | 新增第四行 `分组管理`（原 onManageRequested 死意图接活），ACTION_COUNT 3→4 |
| BookshelfManagementPage.ets | 调试横幅替换为面向用户文案 |
| Index.ets | `startManualBookshelfUpdate()`：排除 LOCAL_SOURCE_ID、与后台 sweep 互斥、`refreshBookshelfCatalogBatch` 增加 onProgress 回调、finally 复位 |
| tools/test-legado-product-logic.mjs | SHF 断言块（sortBy 对、筛选行 toggle、visibleBooks 投影、检查更新入口、Index 队列、互斥、分组管理） |
| tools/test-bookshelf-view-and-menu.mjs | 菜单动作数 3→4（批准扩展 supersession 注释）+ `分组管理` 行断言 |
| tools/test-bookshelf-management.mjs | 横幅断言替换为新文案 |

## Host 测试

全部 PASS：`test-legado-product-logic` / `test-bookshelf-view-and-menu` / `test-bookshelf-management`（本分支改动集重跑）。

## VM 观测（布局树为证据，截图辅助）

| # | 操作 | 观测 | 工件 |
| --- | --- | --- | --- |
| 1 | 冷进书架 | **排序差分**：剑来（已读 <1%，先读过）在网格第 1 位（x=67），庆余年（后加入、从未读过）第 2 位（x=491）→ lastReadAt 降序成立，排除 addedAt/标题序 | shf2-shelf.json, shf2-final.json |
| 2 | more 菜单 | 4 行：批量管理/分组管理/本地导入/书架设置 → 分组管理页可达 | shf2-menu.json |
| 3 | 分组管理页 | 新建分组「测试组」（创建成功）；选中庆余年行 → 应用到所选书籍；状态卡 `已分配到：测试组` | shf2-mgmt*.json |
| 4 | 返回书架，点筛选按钮(1048,812) | 筛选行升起：`全部`(154) `测试组`(378) `检查更新`(644) y≈964；图标激活变绿 | shf2-shelffilter.json |
| 5 | 点 `测试组` chip | 网格只剩剑来（庆余年被分组过滤排除）；点 `全部` 恢复两本 | shf2-grouponly.json, shf2-all.json |
| 6 | 点 `检查更新` chip | chip 变 `检查中 0/2`；hilog `Manual bookshelf update sweep: 2 books`（07:43:46.842）；25s 后 chip 复位 `检查更新`（finally 复位），无 `Bookshelf background update failed` 行 → sweep 完成无失败 | shf2-updating.json, shf2-updone.json, shf-hilog-full.txt |
| 7 | ACQ-02 回归 | sweep 期间搜索页 pill 仍可翻转为 停止（前任务行为未回归） | shf2-search.json |

## 排除/边界

- 本地书（LOCAL_SOURCE_ID）不进手动 sweep 候选；后台 10 分钟 lastCheckAt 节流对手动 sweep 不生效（用户意图）。
- 无新增后台调度；互斥守卫 `bookshelfBackgroundRefreshRunning || bookshelfUpdateRunning` 由 host 测试断言。
- sort 为默认投影，不加排序 UI 切换（P1 定义为"默认排序"）。
