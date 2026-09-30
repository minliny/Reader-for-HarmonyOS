# 换源动态 demo

本地分支：`codex/source-switch-demo-20260930`。基于 `d6c3213c`，独立工作目录，不修改主工作区或合并回 main。

## 立即试用浏览器版

在本仓根目录运行：

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory demos/source-switch
```

然后打开 <http://127.0.0.1:8765>。点击“从零演示”开始；可以停止、重新查找或在发现过程中直接点选来源。所有来源、延迟和切换结果均为模拟数据，不访问真实书源、不读取或修改阅读数据。

浏览器版是上轮已评审动态示意的独立导出，保持 VM 的 1280:2832 屏幕比例、纸色和字体层级。`demos/source-switch/fragment.html` 是可编辑源；`index.html` 是可独立运行的导出。加载图标为网页近似动效。图标库通过固定版本 CDN 加载，核心查找和排序演示不依赖书源网络。

2026-09-30 已通过实际浏览器检查：从零重播、候选陆续出现、按延迟升序排列、刷新保留旧行并标为重测中、查找中点选后停止发现并选中正确来源。截图见 `browser-demo.jpg`。

## HarmonyOS 原生版

- 页面：`entry/src/main/ets/pages/SourceSwitchDemo.ets`，支持 DevEco `@Preview`。
- 模拟数据：`entry/src/main/ets/features/sourceSwitchDemo/SourceSwitchDemoFixture.ts`。
- 复用搜索页的 `SearchSpinner` / 系统 `LoadingProgress`，固定状态行常驻 13 vp 图标。
- 提供小说、漫画、无结果、从零重播和减少动态效果场景；12 个候选陆续到达，并更新已有来源延迟。
- 刷新保留已显示来源；触摸/滚动暂缓排序，点选按稳定 sourceId 处理。页面隐藏、后台、返回取消延迟任务。
- 入口为严格 debug 冷启动布尔参数 `readerSourceSwitchDemo=true`；与其它诊断入口冲突时回退正常入口。
- Demo 入口仅初始化内存主题、字体和窗口，不启动 Core、真实设置恢复、同步或文件导入。正常启动仍然进入 Reader。

必须先使用项目唯一 HAP pipeline 生成 manifest-bound signed 包，才允许安装。请遵守父工作区 `HAP_BUILD_SYSTEM.md` 和已确认 VM 的锁定/保数据操作规则；本记录没有授予新建、重置或清空 VM 的权限。

## 已验证与未完成边界

- 入口、冷启动准入、隔离真实存储、字体准备等 5 项针对性检查通过；模拟事件和排序的本地检查通过。
- 原生页面实际 SDK ETS 解析通过；真实方法转换执行的四项检查通过：重排后按 sourceId 恢复可见偏移、新触摸撤销恢复、生命周期 generation 变化撤销恢复、列表顶端展示新最快来源。此 demo 明确使用 70 vp 行高；放大字体和可变行高仍未验收。
- 当前 Core 产物身份验证和规范 `sync-core` 通过；使用现有 `io.reader.minliny` 包名和用户指定证书的私有配置，`sync-signing` 通过。未生成新证书，私有材料未进入 Git。
- 初次构建被外层 120 秒截止时间中止（`hap-gate-120s.log`）。已改为 Node 内建 4 进程门禁，保留整批 120 秒上限；首轮 384 项在 97.51 秒内全部执行，发现并修复了 3 个隔离输入问题。具体原因和回归见 `BUILD_REPAIR.md`。
- 正式 ArkTS/Hvigor 编译、VM 安装、原生动效与滚动位置验收仍为 OPEN，不能以 SDK 解析、局部探针或浏览器通过替代。
- 本次未安装、启动或更改 VM 内应用，也未操作真实设备。

## 环境记录

首次 checkout 由于缺少 `git-lfs` 失败；分支已创建。第二次仅对该命令关闭历史 evidence 的 LFS 过滤后完成 checkout，post-checkout hook 仍报告缺少 LFS。未改变全局 Git 配置或删除 hook；生产字体/Native 未发现 LFS 指针。

当前主仓尚未提交的包名、签名权威和构建入口更新按最小清单继承，文件哈希见 `setup-provenance.json`；没有复制无关阅读功能改动。Core 通过现有产物校验后规范同步。固定版本 pnpm 10.34.5 安装在本 worktree 的 `.reader-local/hvigor-tools`；首次代理下载中断后，官方 npm 直连安装和版本检查通过。

主工作区切换整合分支后，demo 的 Core 已从链接改为独立 worktree。Git 留存 WIP 的 868 个输入与原包精确一致；恢复和产物身份见 `core-isolation-recovery.json`。离线测试 CLI 的独立输入记录见 `test-input-recovery.json`，不将它当作此次 Native 重新编译的证据。

重复构建需设置 `HVIGOR_SHARED_TOOLS` 指向上述私有目录。本机缺少 Git LFS 时，对此次命令临时设置 `filter.lfs.process`、`filter.lfs.clean` 为空且 `filter.lfs.required=false`，仅用于历史证据目录；不得以此掩盖生产构建输入缺失。
