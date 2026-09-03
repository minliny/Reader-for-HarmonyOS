# VIS-01..03 最小外观（分页+滚动+字体/主题/亮度）— 证据包

- 日期: 2026-08-30
- 验证对象: main c237d2c（无需新代码——本缺口判定为"源码广，运行证据薄"，纯补运行证据）
- HAP: entry-default-signed.hap（SHF-02/03 验收同包）
  SHA-256 = `e486614ba65ff51cfa55c3ee7e3456514d91a8c0a7ac52b606cefd0d0f48483f`
- VM: 127.0.0.1:5555，`install -r` 数据保留，规范锁已释放
- 书目: 庆余年（⭐酷我小说源，楔子 一块黑布）

## 实现定位（ReaderAppearanceGateway / ReaderSettingsGateway）

- 外观快照: preferences `reader_appearance_v1` key `snapshot`（字体/字号/行距/主题/缩进/对齐），进页 `loadAppearanceSnapshot()` 读回
- 阅读设置: preferences `reader_reading_settings_v1` key `snapshot`（navigationMode + pageTransition 分离）
- 亮度: 窗口级 `window.setWindowBrightness`，**设计上不持久化**（默认跟随系统）
- 字号步进 ±2（12–40）、行距 ±0.08（1.2–2.8）；样式切换 `invalidatePageTurnRuntime(true)` 即时生效

## VM 观测

| # | 能力 | 操作 | 观测 | 工件 |
| --- | --- | --- | --- | --- |
| 1 | 控制层 | 正文中央 tap | Dock 目录/朗读/界面/设置 | vis1.json |
| 2 | 界面快面板 | Dock 界面 | 主题库（摘要 `日间：纸纹 · 夜间：夜纹`）+ 字体库 8 槽（系统/宋体/黑体/楷体/仿宋/等宽/思源宋体/霞鹜文楷）| vis2.json |
| 3 | **主题切换** | 点夜间色块 | 面板暗色系（#FF26231F 等）；收面板后正文区亮度 **244.3 → 42.7**（归一化灰度均值） | vis3.json, vis-day-heiti2.jpeg vs vis-night-body.jpeg |
| 4 | **字体切换** | 点宋体/黑体格 | 选中态高亮迁移（宋体→黑体 bg #172D4A3E）；日间同亮度下宋体 vs 黑体正文差分 18.66（字形实变）；基线即宋体故首次点击零差分为预期 | vis5.json, vis4.json |
| 5 | **排版库全量** | grabber 上拉 | FullPanel：首行缩进（不缩进/单字/双字）、简繁、**翻页动画**（仿真/覆盖/平移/滚动/无动画）、文字两端对齐、字号/行距/段距/字距步进器（18/1.96/16/0） | vis8.json |
| 6 | **字号** | 点 + | 值 18→20；行高 **123px→137px**（=字号×1.96×3.5 密度）、每行字数减少、总页数 **18→21** | vis9.json, vis10.json |
| 7 | **VIS-01 翻页样式** | 设置面板 segment | 默认=仿真；切**覆盖**→滑动手势翻页 第2→3页；切**无动画**→第3→4页（样式重建后首手势被吞为边界，重试正常） | vis12/14/16.json |
| 8 | **VIS-02 连续滚动** | 翻页样式→滚动 | 页脚 `第 N / M 页` **消失**（仅剩 % 进度）；大幅滑动内容连续跨屏幅移动（无翻页单位） | vis17-20.json |
| 9 | **持久化** | Back×2 → 书架 → 重进 | 行高 137px（字号 20 保留）+ 无页码/72%（滚动模式+滚动位置恢复）+ 正文亮度 43.2（夜间保留）+ 字体格选中态仍黑体 | vis23.json, vis-persist.jpeg, vis24.json |
| 10 | 亮度轨 | 竖轨拖动 | UI 轨道存在可达（Stack [1117,1871][1201,2193] + A 钮）；**VM 截图绕过 window brightness 变换，差分为 0** —— 设备级观测量，实测留真机批（同断网注入限制） | vis25.json, vis-bri0/bri1.jpeg |

## 结论

- VIS-01（分页样式）、VIS-02（连续滚动）、VIS-03（字体/主题/字号最小外观 + 排版库 + 持久化）VM 级运行证据补全。
- 尾巴：亮度实测效果、Tablet 一致性 → 真机批（RDR-07..10 同行）。
