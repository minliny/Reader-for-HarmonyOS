# theme-palette-matrix VM 验收证据（8d51ef78）

日期：2026-08-30。任务：task #14 —— ReaderThemePalettes.ts 8 主题 × 29 角色配色矩阵的 VM 逐主题浮层验收 + 日间回归。

## 溯源

- 代码：worktree `/private/tmp/ledger-b2-fixes`，branch `feat/theme-palette-matrix`，commit `4f90b42`（37 files, +1184/−745）。host 门禁 `scripts/check-local.sh` → `Harmony contract tests passed: 90`（含 `tools/test-reader-theme-palettes.mjs` 守卫：表完备性/day 逐字节锚/fail-closed/阅读域 hex 清零/TOK 颜色 token 禁用）。
- HAP：`/private/tmp/ledger-b2-fixes/entry/build/default/outputs/default/entry-default-signed.hap`
  SHA-256 `8d51ef788c4182b469b42a9f095070feb25b4b8612d65b9f7a68fc615947834f`（signed）。
- preflight：跑通；`sourceNewerThanArtifact=YES` —— 指向 main 仓 `CMakeLists.txt` 比工件新，**属预期**（main 带 bookturn WIP，本工件构建自 worktree 4f90b42），非本任务漂移。
- 目标：`hdc -t 127.0.0.1:5555`（VM，1320×2856 px）。`install -r` **保留数据**。任务锁 `/private/tmp/reader-vm-locks/reader-harmony-vm-127.0.0.1-5555.lock`（noclobber 获取，验收后释放）。

## 事件记录

- 装包后书架空：DB 取证（/tmp/vm-db-probe）`books=0, bookshelf=0, sources=65` —— 系 bookturn 会话 16:04 前置操作已清书（非本任务丢数据）。经 UI 重新添加 庆余年（⭐酷我小说源，楔子 一块黑布）后继续验收。
- `dumpLayout` 返回陈旧帧（滞后一次交互）：以截图为真值，需要 bounds 时等状态稳定后重 dump。
- night 换源窗两次尝试候选未加载（网络慢），接受 loading 态证据（night-sswindow2/3）；greenNight 窗等 22–25s 后拿到 4 源候选完整证据。
- 误触两次（点击落在正文翻页、grabber 快滑误开 app switcher），均恢复后重拍；受影响首拍（night-sswindow、greennight-sswindow 首版）已重拍覆盖。

## 亮度锚（正文，PIL crop 20%–80%w × 25%–75%h，lum=0.299R+0.587G+0.114B）

| 主题 | lum | 主题 | lum |
|---|---|---|---|
| day | 236.3（day-final 复测 240.4） | night | 50.9 |
| warm | 229.0 | warmNight | 50.9 |
| paper | 206.8 | paperNight | 67.9 |
| green | 224.6 | greenNight | 53.7 |

亮/暗两族清晰分离；暗族 ≈ 既有锚（VIS-01 夜 42.7 同法），paperNight 因渐变纸+纹理略高，判 PASS。

## 程序化断言

- 布局树（artifacts/lay-*.json）：界面面板选中主题色块 `backgroundColor == 矩阵 activeSoft`（day 与 paper 均实测 `#142F6373` ✓）。
- day 族色温通道序：warm R>G>B、green G 占优 —— 色温随主题（截图像素采样）。

## 逐浮层目验结论（截图为真值）

| 覆盖 | 证据（artifacts/） | 结论 |
|---|---|---|
| day 正文/控制层/界面/设置/目录/换源窗 | day-body2/dock/interface/settings/directory2/sswindow/final-body | PASS：换源窗白遮罩+亮窗+4 源延迟条，日间回归零漂移 |
| night 控制层（审计 9 组件之一） | night-dock | PASS：全暗控制层，无日间残留块（本任务核心修复） |
| night 界面/设置/设置全屏/目录/书签/朗读/换源窗 | night-interface/settings/settings-full3/directory/bookmarks/tts/autopage(实拍=朗读面板)/sswindow2/3 | PASS：segments/toggle 关轨把手修复/当前章 accent 条/书签 tab 主色/播放停止按钮/语速滑杆全暗；换源窗暗色+scrim，loading 态 |
| warm/paper/green 正文+控制层+界面 | warm-body2/dock/interface、paper-body2/dock-try2/interface、green-body2/dock | PASS：浮层随正文色温（paper 纹理面、green 绿 primary） |
| warmNight/paperNight/greenNight 正文+控制层+界面 | 三主题 × body/dock/interface | PASS：三暗变体 primary 分族明确（暖金 #CBA672/褐金 #B99C6B/绿 #8FBC9F），浮层全暗一致 |
| greenNight 换源窗（候选加载完成态） | greennight-sswindow2 | PASS：4 源候选（酷我 5634ms 当前高亮/小说三千 1314ms/七猫 102ms/企鹅 365ms）、CandidateRow 暗行+状态点、LatencyBar 琥珀警示、页脚 共 4 个书源 |

## 补充验收（2026-08-30 晚，同锁窗口）

针对上表两处覆盖缺口的补充实拍（截图均在 artifacts/）：

| 缺口 | 证据 | 结论 |
|---|---|---|
| night 自动翻页面板 | night-autopage2.jpeg | PASS：面板暗底、间隔下拉/方向控件、开关均为暗主题值，无日间残留 |
| night 快速搜索面板 | night-quicksearch.jpeg | PASS：搜索框暗底描边、取消按钮、历史/提示文案全暗 |
| night 书内搜索结果 | night-searchresults.jpeg | PASS：结果列表暗行（空结果态） |
| night 替换面板 | night-replace.jpeg（+ lay-replace-night.json） | PASS：输入区/按钮 disabledBg·disabledBorder·primary 角色全走矩阵，无 hex 残留 |
| night 替换沉浸正文 | night-replacefull.jpeg | 行为发现：点「完整管理」会关闭控制层回到沉浸正文（两次含 dump bounds 精确点击复现）——完整管理页在阅读浮层之外，其主题化不在本矩阵范围 |

程序化补充断言（lay-if-night2.json / lay-dock-night2.json）：night 界面网格与 dock 卡片背景色均为暗值，与 night-dock 截图一致。

补充期间事件：17:23 发现已装 HAP 被 bookturn 会话回装为其 main 版（bundle updateTime 1788081850758 佐证），dock 夜间不暗。用 `install -r`（保留数据）重装本任务 HAP 8d51ef78，重开书即夜间 dock 变暗（lum 52.5）+ 主题持久化（重进阅读页保持 night），矩阵确证生效后继续。

仍存的微小缺口（非阻塞）：
- 书内搜索结果命中高亮角色未捕获（`uitest uiInput inputText` 报 Set pasteBoard data failed，无法注入查询词；面板底色主题化已验）。
- 完整管理页（行为上属独立页）未纳入浮层矩阵范围。

## 收尾状态

补充验收后：应用恢复 paper（书架原主题）、庆余年正文、浮层全关（正文 lum 216.4 / dock 区 203.7，无遮罩残留）。矩阵 HAP 8d51ef78 在装，应用数据完整。VM 锁已释放（锁文件移除，symlink 保留）。
