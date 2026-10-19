# 阅读、漫画与换源图标修复

2026-10-20。对应本轮用户授权“修复这些问题”。以下是生产源码调整；源码审阅、编译、原生绘制、交互与用户验收分层记录，不能由本表推导设备已通过。

| 审计项 | 修复及保持的规则 | 源码位置 |
|---|---|---|
| RULE-03 纸面书签 | 实心/轮廓书签均用当前可见阅读纸面的 `readerAppearanceChromeTone(visibleReadingAppearance().activeTheme)` 选择日夜资源。与旁边箭头、文字取同一可见阅读快照，避免全局日间配夜间阅读纸面时错色。原单一 Image、书签预览/提交、隐藏、透明度规则保持。 | `LocalReadingExperience.ets` 的 `bookmarkCornerFeedback` |
| RULE-04 漫画按下反馈 | 漫画顶部公共图标按钮把纸面 `ink` 映射为 night，其余为 day，并传公共 `ReaderIconButton.scheme`，图标与按下背景采用同一上下文。章节加载页返回图也显式传实际纸面 scheme。公共组件保留 auto 默认，普通页面继续采用应用主题。 | `MangaReadingSurface.ets` 的 `iconAction`；`ReaderChapterLoadingState.ets` |
| ICON-05 漫画翻页语义 | 现有前后页按钮补“上一页/下一页”、BUTTON role 与同真实准入一致的 focusable；仍调用原 `stepPage(-1/1)`，不更改章末翻章或禁用边界。 | `MangaReadingSurface.ets` 的 `bottomControls` |
| RULE-10 原生等待 | `SourceSwitchSpinner` 收敛为 `LoadingProgress` 的薄适配。保留尺寸、主题色、active 可见性；仅 mounted、active、foreground、非 reduceMotion 同时成立时启用原生动画。移除 JS/vSync animator、自绘 Path、旋转状态及 duration/stroke 参数，两个调用点同步移除参数。环形几何与周期由平台原生组件决定。 | `SourceSwitchSpinner.ets`；`SourceSwitchProgress.ets`；`SourceSwitchWindow.ets` |
| RULE-11 目录叠绘 | 删除 helper 的额外 Image 和仅为旧 probe 留存的 selector 方法；保留每个动作、日夜/排序状态的显式资源分支，每个按钮只绘制一个资源。现有工具尺寸和回调保持，补 BUTTON role/focus。 | `ReaderDirectoryToolbar.ets` 的 `tool` |
| RULE-12 定时循环语义 | 快捷定时由下拉箭头改用已登记 Refresh 上游几何的 `reader_tts_timer_cycle` 日夜变体，沿既有 TOK_TTS_TEAL 色。12vp 正方形容纳循环符号；辅助名称明确“循环切换定时预设”。继续调用原 `cycleQuickTimer()`，保留完整态选择列表，不增加新选择流程。 | `ReaderControlTtsContent.ets` 的 `timer`；资源配方由资源修复项记录 |

`Reader-UI/design/source-switch/source-switch.visual.json` 及其生成投影中原有 spinner stroke/duration 字段现已无生产消费者；它们不再控制原生加载精度或周期，本轮未直接手改生成副本。

本子任务只做定点源码审阅和修改，未运行测试/门禁、构建、安装或设备取证。书签四种应用/纸面组合、漫画 press 实际绘制与辅助服务输出仍需对应的后续原生证据；不能以新增名称宣称所有辅助服务行为已验收。
