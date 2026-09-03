# 视觉验收分支（visual/acceptance）使用说明

本分支**只做 Figma 视觉验收**。所有页面由手写或确定性生成器产生的合成 fixture 数据渲染：Core NAPI 运行时完全不启动、无网络、零实机数据。任何在本分支上看到的业务数据都不代表真实功能状态。

## 1. 工作原理

- `EntryAbility.onCreate` 在安装运行时之前调用 `installVisualScenario(want)`，从启动参数读 `visualScenario`（缺省 `default`）。
- `ReaderRuntimeOwner.request()` 第一行检查 `visualModeActive()`：命中则直接由 `VisualTestFixtures.respond()` 返回 fixture 信封，`start()` 同样被短路——**NAPI 运行时永不创建**，Host capability router 永不注册，`http.execute` 等真实 Host 能力不会发生。
- `ReaderProductScope` 使用 `visual-test` profile：发现/RSS/同步等全部页面入口打开（仅为本分支）。
- 未知命令 fail-loud：hilog 输出 `VISUAL_FIXTURE_MISSING: <method>` 并 reject，页面显示错误态，不静默伪装。
- 变更确认类命令（`reading.progress.update`、`bookmark.create/delete`、`bookshelf.add/remove/removeBatch`、`reader.location.resolve`、`book.search`、`rss.entry.read`、`read-record.accumulate` 等）由内置 echo 处理器按各 Gateway decoder 的校验规则回显请求参数。
- `SettingsGateway` 直写 `@ohos.data.preferences`，是**唯一真实写入**（无害，重启保留）。

## 2. 测试材料说明（小说 fixture）

- `tools/generate-visual-novel-fixtures.mjs` 使用仓库内置的确定性模板生成 16 章完全合成正文，不读取外部文件，也不访问网络。
- 正文用于覆盖多页分页、文本选择、书签和阅读进度；人物、地点、事件与数值均为虚构测试数据。
- 正文/目录/进度/度量数据（`local_book.toc`、`local_book.chapter.content`、`local_book.content.metrics`、`cache.book.status`、`reading.progress.get`）在 `DefaultScenario.buildNovelScenario()` 中按 `NOVEL_CHAPTERS` **运行时计算**，长度与累计度量自动保持一致。
- 修改模板后重新生成，不要直接手改 `FixtureNovelText.ts`：

```bash
node tools/generate-visual-novel-fixtures.mjs
```

## 3. fixture 文件结构

| 文件 | 职责 |
|---|---|
| `app/visual/VisualTestConfig.ts` | 场景状态、`installVisualScenario`、共享类型 |
| `app/visual/VisualTestFixtures.ts` | 命令漏斗：echo 处理器 + 规则匹配 + 信封 + fail-loud |
| `app/visual/fixtures/DefaultScenario.ts` | 主数据集：严格 JSON 字面量区 + 小说派生区 |
| `app/visual/fixtures/EmptyScenario.ts` | 空态数据集（全部列表为空） |
| `app/visual/fixtures/FixtureNovelText.ts` | 完全合成的小说正文（生成器产物，勿手改） |
| `tools/test-visual-fixtures.mjs` | 门禁测试（`scripts/check-local.sh` 自动运行） |
| `tools/generate-visual-novel-fixtures.mjs` | 小说 fixture 生成器 |

规则三种形态（字面量区与小说区通用）：

- 纯数据对象：直接作为响应 `data`；
- `{ "match": {...}, "data": {...} }`：`match` 每个键与请求参数相等（值可为数组表示任一命中）才响应，数组规则取第一个命中；
- `{ "__error__": { "code": "...", "message": "..." } }`：reject，页面呈现错误态。

## 4. 编辑规则

- **字面量区（`DEFAULT_LITERALS` / `EMPTY_LITERALS` / `FIXTURE_SEARCH_BOOKS`）必须是严格 JSON**：双引号键、无尾逗号、不得引用 TS 标识符。门禁测试逐值 `JSON.parse` 强制。
- 字面量区与小说的一致性（书名/作者/chapterCount/当前章题/书签章名）由门禁交叉校验；修改合成模板后如果这些字面量过期，门禁会指出。
- 默认场景封面一律留空（`coverUrl` 不出现），触发 NoCover 视觉态；正文不含图片。
- 远程书 `星陨大陆` 的 `lastCheckAt: 4102444800` 是**故意的未来时间戳**：让书架后台刷新链（`book.detail/book.toc/...`）永不触发。删除它会导致 fail-loud。
- 门禁命令：

```bash
node tools/test-visual-fixtures.mjs
```

## 5. 场景切换

安装后通过启动参数选场景（`aa start` 重启应用生效）：

```bash
# 主数据集（默认）
hdc shell aa start -a EntryAbility -b io.reader.harmonyos -m entry --ps visualScenario default

# 空态
hdc shell aa start -a EntryAbility -b io.reader.harmonyos -m entry --ps visualScenario empty

# 逃生口：放行真实 Core 运行时（仅用于对照，日常验收不用）
hdc shell aa start -a EntryAbility -b io.reader.harmonyos -m entry --ps visualScenario off
```

若本 SDK 不支持 `--ps`，临时改 `VisualTestConfig.ts` 的 `DEFAULT_VISUAL_SCENARIO` 常量。

## 6. 状态配方

- **空态**：`visualScenario empty`（空书架/空书源/空 RSS/空搜索历史/空发现）。
- **错误态**：在对应命令的规则上加 `{ "__error__": {...} }`，或临时删除该命令的 fixture（fail-loud）。
- **加载态**：暂不提供该命令的 fixture（fail-loud 显示错误态）——真正的骨架屏加载态需后续加延迟机制，本分支先不模拟。
- **远程阅读链**（`book.detail`/`book.toc`/`chapter.content` 远程变体/`cache.book.prefetch` 等）未覆盖：点开远程书会 fail-loud，属预期，按需补 fixture。
- `rss.favorite.persist/remove`、`rss.subscription.persist/remove`、`rss.feed.refresh`、`sync.webdav.*`、`bookshelf.removeBatch` 之外的批量管理等写命令未覆盖，触发即 fail-loud（hilog 可见），按需补。

## 7. VM 验收流程

本地构建环境（fresh worktree 首次必做）：

```bash
/Applications/DevEco-Studio.app/Contents/tools/ohpm/bin/ohpm install --all   # oh_modules 不入库，file: 依赖需链接
DEVECO_SDK_HOME="/Applications/DevEco-Studio.app/Contents/sdk" scripts/check-local.sh --hap
hdc install -r entry/build/default/outputs/default/entry-default-signed.hap
hdc shell aa start -a EntryAbility -b io.reader.harmonyos -m entry --ps visualScenario default
```

- node 须用 Homebrew 版（`PATH="/opt/homebrew/bin:$PATH"`）：DevEco 自带 node v18 跑不动部分契约测试。
- 签名配置保持在本地交付流程中，不写入本分支；构建和安装时遵循仓库既有 HAP 交付规范。

验收时确认 hilog：

- **无** `VISUAL_FIXTURE_MISSING` / `VISUAL_FIXTURE_MATCH_MISS`；
- **无** Core 启动日志（无 `Core build identity`、无 `runtime.setHostCapabilities`）。

走查清单：书架 3 态（TXT 带进度/EPUB 无进度/远程卡）→ 详情 → 阅读（真实分页、书签、进度提交、跨章）→ 搜索（历史+结果）→ RSS（列表/条目/详情/收藏）→ 设置 → 书源管理 → 发现；再用 `empty` 场景走一遍空态。

## 8. 合并护栏（硬约束）

- 本分支的一切（`visual-test` profile 默认值、visual 守卫、fixture、本文档）**永不合回 main**。
- 分支 diff 只允许 3 个既有接线文件（`ReaderRuntimeOwner.ts`、`EntryAbility.ets`、`ReaderProductScope.ts`）+ 1 个既有测试（`tools/test-reader-product-scope.mjs`，本分支断言 `visual-test` 语义，主干保留 l0 断言）+ `app/visual/*` 新增 + `tools/test-visual-fixtures.mjs` + `tools/generate-visual-novel-fixtures.mjs` + 本文档；`build-profile.json5` 必须保持未修改。
- 门禁第 (d) 项强制 `VisualTest*` 只被这 3 处引用，防蔓延。
