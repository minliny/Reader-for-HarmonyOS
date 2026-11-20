# 搜索结果宿主分支未响应路由（2026-10-27）

- 用户报告搜索图标异常和点击闪退，候选 `20261027T044135Z-3b297fdc-be2949b8`。本项是代码审查中确认的独立挂载缺陷，不把它认定为闪退根因；进程退出仍需实际异常证据。
- `Index.librarySearchSurface` 的 `results` 参数在普通箭头闭包中直接写路由 `if`。实际 SDK 编译产物保留普通 JS 条件，`ReaderLibrarySearchSurface` 只在构建时执行 slot；初始书架条件为 false，切换搜索时没有原生响应式 `If` 分支负责挂载 `SearchPage`。
- 修复将路由条件移入具名 `@Builder librarySearchResults`，slot 只调用该 Builder。现有业务 owner、查询和安装身份不变。
- 本次唯一必要回归入口：`node tools/test-library-search-results-builder.mjs --case retained-route`。仅将实际生产 Builder 用已安装 SDK 降低并执行发出的 observe/If 闭包，检查同一宿主从书架进入搜索、退出及旧内联条件的负控。无嵌套测试、构建、签名或设备操作；不证明本次闪退已修复或真机交互通过。
- 该入口 PASS：初始书架注册响应式路由分支，同一宿主进入搜索创建页面、保持搜索不重复创建、退出移除、再次进入创建新页面；旧内联条件负控没有 observer，路由变化后仍不创建页面。

## 持续挂载宿主的 primitive 参数冻结

- 同一编译审查还发现 `librarySearchSurface` 按值接收 identity、navigationGeneration、mounting、moreIdentity。SDK 为持续挂载的子组件发出的更新闭包继续读取旧方法参数，外层书架/搜索共用同一个 If 分支，没有通过重建更新该捕获。子组件收到旧身份后，新页面的返回和测量回调被既有安全检查拒绝。
- 修复只保留 runtime owner/searchHost 两个对象参数供回调判定原所有者；四个变化字段在子组件参数处直接读取 Index 状态。旧事件、替换的 runtime 和 searchHost 仍被拒绝。
- 新发现需要新增的唯一检查是 `node tools/test-library-search-surface-binding.mjs --case retained-inputs`：同一已安装 SDK 降低实际 Builder，执行实际 child-update 闭包核对四个字段刷新，以及旧事件、runtime/host 的负控；恢复旧参数传递方式后重现冻结。第一次探针因缺少 SDK 源文件诊断上下文失败，补齐 `transformLog.sourceFile/contextGlobal` 后 PASS；没有更改生产行为来绕过检查。
