# PH60 手动检查更新的缓存准入审计

2026-09-14；本轮用户批准 PH60 More 的“检查更新”。代码先行：`Index.startManualBookshelfUpdate → refreshBookshelfCatalogBatch → refreshOneShelfBook → RemoteReadingFlowGateway.openSession(seed)` 未传强制刷新；Gateway 转入 Coordinator.acquireBook 后允许返回24小时内prepared session，因此手动点击可能完全没有新目录请求。本轮未用设备复现，也不认定该问题已被用户在真机具体触发。

先定位 `forceRefresh` 到真实目录/Core RPC 的全链，再用实际业务方法红绿验证；限 Index 更新调用链及必要既有 Gateway/Coordinator 适配，不改页面 build、其他书架组件、Core事实、设备、HAP或提交。自动刷新节流、失败旧TOC/正文/阅读位置保持不变。

## 定位结论

1. `RemoteReadingFlowGateway.ts:162` 优先委托 `Coordinator.acquireBook`。未强制时先返回24小时内prepared对象，未命中也会在 `openBook` 中尝试持久目录；这两处都可能使检查更新只有旧目录投影而没有新网络请求。
2. 只在Index加参数仍不完整：Coordinator先按身份加入任何在途BookJob，再检查prepared。强制请求可能加入一个正在读本机目录的普通任务，从而仍不请求新目录。
3. Core `crates/reader-runtime/src/remote.rs:7417 book_toc` 在传入tocUrl时构造 `pending_source_fetch`，不先返回持久TOC；`HttpExecuteHost.ts:678`明确`usingCache:false`。所以绕开Host书籍准入缓存后，现有detail→toc链已具备真实重新请求能力；不需要清缓存或新增Core强制参数。
4. Core `remote.rs:7530` 起只有至少一条可读章节才写新TOC，并按目录写锁/请求启动时间拒绝旧请求覆盖；`runtime.rs:8770 empty_book_toc_preserves_last_non_empty_cache`已有相应回归。此轮只读确认Core，未改也未重跑Core；当时Core为clean `bf3e2682051f0c5d84103800c1cec4e7140b203c`。

## 实施（已冻结）

- `Index.refreshOneShelfBook` 调 `openSession(seed,{forceRefresh:true})`，手动检查和已通过自动开关/10分钟lastCheckAt筛选的候选都真正查新目录。自动候选范围、10分钟阈值、最多2本并发和手动/自动互斥均保留；不把筛选后的可见书籍集合偷换为更新范围，仍更新当前书架在线候选。
- `BookAcquisitionCoordinator.BookJob` 标明是否强制任务。强制请求遇到普通在途任务，等待它settle后重新进入既有acquireBook；重入会检查owner、isCurrent以及最新源版本。随后多个强制请求继续加入同一个强制任务，不新造调度器，不取消旧任务的已有消费者。
- 普通任务抛错不会永久阻止手动重试。关闭owner、请求失效或源已删除时，不在等待结束后继续网络获取。所有修改不清TOC、正文、书架或阅读进度。
- 单书失败仍由原批处理隔离并继续，done表示已经尝试数量，不作为成功数量。旧Core恢复保障保留；Host不会将空目录标成成功可读会话。

本次是把PH60“检查更新”入口接实的审计过程中发现的功能缺陷，不是用户新定义数据缓存语义。自动已经到期却仍命中24小时书籍缓存属于同一原因，经root授权一并修复，但没有改自动频率。

## 红绿与本地验证

新增 `tools/test-bookshelf-manual-update.mjs` 运行真实SDK提取的Index四个方法，加真实RemoteReadingFlowGateway、BookAcquisitionCoordinator、BookRequestScheduler；只替换Core RPC I/O边界和正文预取观察口，不mock掉缓存准入或刷新逻辑。

- 修前 `/private/tmp/ph60-manual-update-red.log`：prepared、持久缓存、普通任务在途的三个案例都得到0次book.toc而应为1；含失败/空结果/正常三本的检查得到0次而应为3。原自动节流独立断言通过。
- 修后 `/private/tmp/ph60-manual-update-green.log`：**9项通过**：手动prepared；持久目录；普通任务在途；错误/空目录仍继续下一本、重复点击和并发2；到期自动候选（先有prepared再验证获取新增章）；多个force共享一次；等待时cancel/close/source-delete三种重新准入拒绝。
- 生产路径验证详细：先建1章prepared，然后服务端fixture变成2/3/4/6章；手动/到期自动触发真实Gateway的detail和toc方法，最终预取接收新章节数组。未到期、local、关闭自动、已有批处理均不被新增网络请求污染。
- 相关既有组通过：`test-book-acquisition-coordinator.mjs`、`test-search-orchestrator.mjs`、`test-remote-reading-flow-runtime.mjs`、`test-remote-reading-flow-gateway.mjs`。日志为 `/private/tmp/ph60-update-<文件名>.log`。
- 并行运行 `test-legado-product-logic.mjs` 在旧第105行对 `ShelfBookPresentation.visible(this.books,this.selectedGroup)` 的正则失败，原因是root正在加入PH60筛选实参；已交root随页面测试更新，不将此项记为通过。一次误指定不存在的 `test-remote-reading-contract.mjs` 得到MODULE_NOT_FOUND，没有执行测试，不计通过。

测试中旧目录保留fixture只证明Host没有清除/改写命令；真实Core的旧数据保护依据是上面的现有生产代码和既有测试，不能把模拟I/O当成本轮Core或真机验收。

## 文件/交付边界

生产仅 `Index.ets` 的 `refreshOneShelfBook` 和 `BookAcquisitionCoordinator.ts` 的BookJob/acquireBook；新增一个专项测试和本报告。未改Index build、书架筛选/菜单/批量组件，未改Core、未操作设备或HAP、未提交。root负责统一检查、构建和最终证据。真机具体检查更新结果未在本轮取证。
