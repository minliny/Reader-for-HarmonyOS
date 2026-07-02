# ReaderShell 文本层级和位置审计

本文档补齐 ReaderShell 骨架中被遗漏的文字层级。结构宽度和锚点见 `HARMONYOS_READER_DEMO_LAYOUT_RELATIONSHIP_AUDIT.md`，本文件只记录各类文本的位置、字号、行高、字重和 ArkUI 当前落点。

边界：

- demo 的 CSS / DOM selector 只用于读取设计证据，不作为 HarmonyOS 实现接口。
- HarmonyOS 侧必须用本地 ArkUI 文本 token、`Text`、`Row`、`Column`、`Stack` 和本地状态实现。
- 字号单位在 demo 中是 CSS px；ArkUI 侧按同名语义落为 fp/vp，并由设备密度和系统字体策略渲染。

## 1. 读取来源

- `/Users/minliny/Documents/Reader UI/frontend-demo/fixture.js`
- `/Users/minliny/Documents/Reader UI/frontend-demo/render-runtime.js`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/01-shell-layout.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/02-main-library.css`
- `/Users/minliny/Documents/Reader UI/frontend-demo/styles/03-reader.css`

## 2. 正文排版层

demo 来源：

- `normalizeReaderTypography(...)`
- `.fd-ir-reading-layer`
- `.fd-ir-reading-layer h1`
- `.fd-ir-reading-layer p`

| 文本类型 | demo 值 | 位置关系 | ArkUI 当前 token |
|---|---:|---|---|
| 正文框 | demo 默认 top `72`，side `32`，bottom `48` | 绝对 inset；不属于控制层；Web h1 文本自身有行盒下沉 | ArkUI 使用 `bodyTopInset=80` 补偿 Text 行盒，left/right `32`，bottom `48` |
| 章节标题 | 正文字号 + `5` = `23`，line-height `1.25`，bottom `24` | 正文第一页居中显示；文本内容必须按 `ReaderContext.chapterTitle` 原样显示 | `bodyTitleFontSize=24`，`bodyTitleLineHeight=30`，`bodyTitleBottom=28` |
| 正文段落 | `18`，line-height `1.96`，段距 `16` | 左对齐，段首缩进属于排版能力，不应通过改写正文字符串模拟 | `bodyFontSize=18`，`bodyLineHeight=35.28`，`bodyParagraphGap=16`；当前不向正文插入额外字符 |
| 字距 | `0` | 不随 viewport 缩放 | `letterSpacing` 暂不暴露，保持 0 |
| 字体族 | `serif` 语义 | 阅读正文与 UI 控件分离 | ArkUI 先用 `Songti SC`，后续需做系统字体可用性验证 |

当前证据：

- `artifacts/reader-ui-slice/layout-typography-immersive.json`
- `artifacts/reader-ui-slice/layout-typography-control-v2.json`

关键约束：

- 正文标题和段落只读取 `ReaderContext.chapterTitle`、`ReaderContext.contentPreview`，不得在 Host 侧补造正文。
- demo 中出现的章节号处理只作为 Web proof 的现象记录，不作为 HarmonyOS 默认文本改写规则。
- 如果当前入口只有书名、作者、进度而没有章节正文，阅读正文层应保持空内容，等待真实阅读数据接入。

## 3. 沉浸信息层

demo 来源：

- `.fd-ir-info-layer`
- `.fd-ir-top-left`
- `.fd-ir-top-right`
- `.fd-ir-bottom-left`
- `.fd-ir-bottom-right`

| 文本类型 | demo 值 | 位置关系 | ArkUI 当前 token |
|---|---:|---|---|
| 信息层 inset | top `26`，left/right `24`，bottom `22` | 两列三行，内容不接收点击 | `immersiveInfoTop=26`，`immersiveInfoHorizontal=24`，`immersiveInfoBottom=22` |
| 书名/章节 | `12`，line-height `1.2` | 左上，单行省略 | `immersiveInfoFontSize=12`，`lineHeight=14.4` |
| 时间 | `12`，line-height `1.2` | 右上靠右 | 同上 |
| 进度 | `12`，line-height `1.2` | 左下 | 同上 |
| 页码/capsule | `12`，line-height `1.2` | 右下靠右；session 时可跨列 | 同上 |

当前约束：

- 左上只拼接真实书名和真实章节；如果其中一项为空，不显示多余分隔符。
- 右上时间来自本地系统时间，不再写死为 demo 截图里的固定时间。
- 左下进度只读取 `ReaderContext.progressText`；右下页码在分页数据接入前不显示伪页码。

## 4. 顶部阅读栏

demo 来源：

- `.fd-reader-top`
- `.fd-reader-top strong`
- `.fd-reader-top small`
- `.fd-reader-top button`

| 文本类型 | demo 值 | 位置关系 | ArkUI 当前 token |
|---|---:|---|---|
| 标题 | `16` | 中间弹性列；可两行但不挤压按钮 | ArkUI 视觉校准为 `topBarTitleFontSize=15` |
| 副标题/来源 | `12` | 标题下方；内容是章节/来源，不是 reader mode | ArkUI 视觉校准为 `topBarSubtitleFontSize=10`，`topBarSubtitleLineHeight=12`，`topBarTextGap=3` |
| 按钮文本 | `12`，weight `800` | 返回/换源/更多列宽稳定 | `topBarButtonFontSize=12` |

当前证据：

- 修正前 `活着` 为 `[493,226][605,292]`，`控制` 为 `[507,313][592,362]`，标题列居中且副标题语义错误。
- 修正后顶栏标题列保持左对齐，副标题使用章节/来源语义；来源只能来自 `ReaderContext.sourceId`，不能用实现层硬编码兜底造内容。
- 本轮收紧后副标题 token 为 `10/12/3`，即字号 `10`、行高 `12`、标题到副标题间距 `3`。

## 5. 控制层主体文本

demo 来源：

- `.fd-reader-actions button`
- `.fd-reader-chapter-row strong`
- `.fd-reader-book-progress`
- `.fd-reader-total-chapters`

| 文本类型 | demo 值 | 位置关系 | ArkUI 当前 token |
|---|---:|---|---|
| 快捷动作标签 | `11`，weight `800` | 三列按钮中心；按钮尺寸固定 | `actionLabelFontSize=11` |
| 章节标题 | `13`，line-height `1.25` | 上/下一章之间弹性居中 | `chapterTitleFontSize=13` |
| 上/下一章 | demo 为 34 方形图标按钮；骨架暂用文字 | 左右固定区域 | `chapterStepFontSize=11` |
| 进度文本 | `9`，line-height `1` | progress 左右两端 | `progressLabelFontSize=9` |

当前约束：

- `搜索`、`自动翻页`、`内容替换` 是控制按钮标签，可以作为 UI 命令文案保留。
- 章节标题和进度文本只来自 `ReaderContext`。
- 总章节数、搜索结果、缓存容量在真实数据接入前不得写死。

## 6. 亮度 Rail、模块导航和更多菜单文本

demo 来源：

- `.fd-brightness-rail`
- `.fd-reader-module`
- `.fd-reader-more-menu`

| 文本类型 | demo 值 | 位置关系 | ArkUI 当前 token |
|---|---:|---|---|
| 亮度标签 | demo 主要是图标语义；骨架暂用 `亮/A` | 固定竖向 Rail 顶/底 | `actionLabelFontSize=11` |
| 模块标签 | `12`，weight `800` | 42 图标 shell 下方 16 高标签行 | `moduleNavLabelFontSize=12` |
| 更多菜单标题 | `12` | 菜单项第一行，单行省略 | `moreMenuTitleFontSize=12` |
| 更多菜单说明 | `10` | 菜单项第二行，单行省略 | `moreMenuDetailFontSize=10` |

当前证据：

- `目录/朗读/界面/设置` 仍按四等分模块导航显示。
- `刷新本章` 为 `[555,469][724,518]`。
- `重新拉取当前章节正文` 为 `[555,532][906,573]`。

## 7. 仍未完成

1. 正文段首缩进暂未落地；后续应验证 ArkUI 目标 SDK 是否可用原生 `Text` 首行缩进能力，不能通过插入空格改正文字符串。
2. 控制层上/下一章、亮度、模块图标仍是文本占位，后续应替换为原生图标或本地 vector asset。
3. ArkUI 系统字体与 demo Web 字体不完全等价，`Songti SC` 可用性需要真机验证；当前先保证字号、行高、位置关系。
4. 横屏、平板、fold posture 下的文字避让和字号不在本轮完成范围。
