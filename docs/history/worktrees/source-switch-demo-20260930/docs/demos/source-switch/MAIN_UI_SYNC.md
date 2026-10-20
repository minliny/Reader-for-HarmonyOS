# 主工作区 UI 同步候选

本候选尚未应用到主工作区，未修改主工作区文件或暂存区。

- 主基线：`63a5ab653fb573c5369ea67a4edc12b4a9dffcae`。保留外部 `8deb2ccf` 的 HAP 输入及书源诊断改动、`63a5ab65` 的分页模型测试改动。
- 隔离分支源码：`bdf8bcde87f1c547a2cae97ba65351be47825e3d`。
- 候选树：`f840dd515c867b9f6b5331dead40511c55c33105`。
- 补丁：`main-ui-sync.patch`。
- SHA256：`9eb8a196d33ebc624a4e656c2722806f402f98a98477b7641f1ff43d72f7303e`。
- 范围：**27 文件**，其中 9 个生产文件、17 个测试文件、1 个测试分层注册表。

书架共享壳、设置和详情布局使用已审阅的窄差分；继续阅读卡读取 live provider；分页和连续阅读标题 recipe 使用 keyed 生命周期绑定。ReadingSurface 只增加标题绑定差分，保留主分支 `fragments` 响应依赖及原 offscreen 负控。目录业务、阅读入口及主分支分页模型测试增强保留，Index 非书架部分字节不变。补丁不包含换源、Core、Native、签名或流水线变更，也不回退外部主分支提交。

本轮只比上版 26 文件候选多一项旧手机布局测试适配：从实际 continueReadingCard 方法提取新 provider 签名，同时保留相同的 shelfContentWidth 宽度断言；没有新增生产改动。

## 验证

- 上版候选树 `287d0156d62c308bdb684f5864b6a69402be86bb` 的 18 项定向检查全部通过，用时 3.473 秒，Node v26.0.0。覆盖继续阅读卡发布、分页/连续标题退出、标题权威来源、离屏响应属性、Native paragraph owner/view、主分支分页模型及关键书架回归。
- 新候选与该树仅差 `tools/test-phone-layout-figma-regressions.mjs`；生产及此前 18 项测试输入均不变。只补跑手机 Figma 布局测试，PASS，耗时 0.112 秒；未重复原 18 项，也不将其写成新版全量门禁。
- 测试分层数据完整且无重复：source 173、integration 235，共 408 项。新增以下 5 项 integration 注册；注册表原 `100755` 模式保持。

- `test-bookshelf-continue-reading-publication.mjs`
- `test-bookshelf-detail-scroll-layout.mjs`
- `test-bookshelf-settings-layout.mjs`
- `test-bookshelf-shell-states.mjs`
- `test-reader-title-recipe-lifetime.mjs`

- 最后 `git diff --cached --check` 与 live `git apply --check` 均通过，时间 `2026-09-30T19:22:29.418337+00:00`；当时主 HEAD 与基线一致，工作树干净。
- 未为此主候选运行 full gate、HAP 或 VM。SDK observer/Prop/Watch 结果不证明 native disposal、布局、合成器像素或用户验收。
- 隔离分支未跟踪的 `test-reader-paragraph-indent 2.mjs` 不属于主同步输入，未纳入候选，也未由此任务删除或改动；隔离分支全量门禁由根任务单独记账。
- 详细版本、逐项结果及复用边界见 `main-ui-sync-metadata.json`；可应用性快照见 `main-ui-sync-live-check.json`。本机临时日志不代表已交付构建产物。

## 精确文件范围

- `entry/src/main/ets/features/bookshelf/BookshelfEmptyPage.ets`
- `entry/src/main/ets/features/bookshelf/BookshelfPage.ets`
- `entry/src/main/ets/features/bookshelf/BookshelfSettingsPage.ets`
- `entry/src/main/ets/features/bookshelf/BookshelfShell.ets`
- `entry/src/main/ets/features/bookshelf/BookshelfStatusContent.ets`
- `entry/src/main/ets/features/bookshelf/LocalBookDetail.ets`
- `entry/src/main/ets/features/reading/ReaderContinuousReadingStage.ets`
- `entry/src/main/ets/features/reading/ReadingSurface.ets`
- `entry/src/main/ets/pages/Index.ets`
- `tools/contract-test-tiers.json`
- `tools/test-bookshelf-continue-reading-publication.mjs`
- `tools/test-bookshelf-detail-scroll-layout.mjs`
- `tools/test-bookshelf-filter-responsibilities.mjs`
- `tools/test-bookshelf-management.mjs`
- `tools/test-bookshelf-more-layout.mjs`
- `tools/test-bookshelf-physical-feedback.mjs`
- `tools/test-bookshelf-reading-entry.mjs`
- `tools/test-bookshelf-settings-layout.mjs`
- `tools/test-bookshelf-shell-states.mjs`
- `tools/test-legado-product-logic.mjs`
- `tools/test-phone-layout-figma-regressions.mjs`
- `tools/test-reader-chapter-first-title-publication.mjs`
- `tools/test-reader-fragment-authority.mjs`
- `tools/test-reader-paragraph-indent.mjs`
- `tools/test-reader-title-recipe-lifetime.mjs`
- `tools/test-reader-window-chrome-p0.mjs`
- `tools/test-reading-document-window.mjs`

实际应用前若主分支变化，应重新检查可应用性。生成过程使用私有 index/objects，未写入主暂存区。
