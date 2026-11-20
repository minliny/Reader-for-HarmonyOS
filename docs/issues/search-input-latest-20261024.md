# 搜索栏最新输入跟随（2026-10-24）

## 用户现象与范围

用户反馈搜索页搜索栏的文本输入框“没办法跟踪最新输入”，随后明确为“长文本不滚动，看不到末尾和光标”。已与旧查询覆盖草稿区分。当前 Host `main` / `6b1bd753` 含其他未提交工作。

## 已审调用链

- `SearchPage.searchBar` 的 native → ReaderSearchField.onTextChange → 父 keyword 与 SearchViewState.keywordDraft 同步赋值；当前 query owner 失效时拒绝旧 callback。
- `SearchOrchestrator` 的异步结果/进度不写 keywordDraft；`SearchPage.acceptPublication` 只读 publication。refreshVisibleResults 仅在 query revision 改变时读取当时的 keywordDraft，不把结果 presentation.keyword 回写编辑框。
- `SearchHost.search` 与提交时的 query reset 确实会重置本次草稿；这是主动提交边界，不能与旧结果异步覆盖混为一谈。
- `ReaderSearchField.fixedLineHeightField`（实际 variant=bookPanel）直接把父 `@Prop text` 传给 TextInput；onChange 原样上报 value，没有 trim、格式化或主动移动光标。
- 原生 TextInput 使用单行、layoutWeight(1)、透明底色/零内边距/零圆角；外层字段的 Row width=100%，父级留出返回与搜索按钮的加权宽度。父搜索卡片 clip(true)，编辑框本身没有自建水平 Scroll、selection、controller 或每次强制末尾逻辑。
- 安装 SDK 的 text_input.d.ts 说明 onChange 包含可选 PreviewText；预上屏默认开启，执行 caret 操作必须考虑 previewText。当前源码未执行 caret 操作，因此不能以“没有处理 PreviewText”单独认定错误。

## 最小验证计划

准确入口 `node tools/test-search-input-latest.mjs --case book-caret-follow`。只检查实际 SearchPage.searchBar → ReaderSearchField → native TextInput 的 SDK Builder 与属性运行时：连续输入、父状态尚未刷新时再输入、中间编辑、原生 PreviewText 参数、结果 replay、外部草稿/清除及旧 query callback。内部使用安装 SDK lowering、实际 SDK 属性运行时、生产 FocusFrame 与高度方法；仅原生 Controller、帧队列及非输入外观组件为边界，不泛化公共 helper，不构建、不调用 HDC、不跑全量。新增行为是布局后对 native caret 的范围滚动，必须验证实际 controller 绑定、调用参数和调度准入，单独检查静态样式不足，因此本 case 不能省略。不附带现有字体或其他搜索回归。

如果绑定路径测试不能定位真实横向裁剪，需要在记录排除项后才安排最小设备取证，目标仅回答“原生值/selection/scroll与控件实际矩形是否一致”。静态 attribute 与伪 native 端口不能证明光标像素可见，不能凭测试通过写成设备修复。

## 当前结论

- 代码审计未发现旧 query/结果覆盖已保存草稿的路径；用户随后明确的现象是长输入的可见区跟随。
- 最小修复在 `ReaderSearchField` 的 bookPage/bookPanel：保留一个 TextInputController，输入、原生 selection、外部 text 与实际尺寸改变时合并一次布局后同步，读取当时的原生 caret.index，再调用 `scrollToVisible({start:index,end:index})`。不调用 caretPosition/setTextSelection/clearPreviewText；保留 native selection、IME 预上屏和中间编辑。失焦、卸载、过期帧、无效/已解绑 index 均拒绝请求。
- 项目兼容/目标为 API 23，安装 SDK 已声明该接口。公共[输入控制器文档](https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/reference/apis-arkui/arkui-ts/ts-universal-attributes-text-style.md#scrolltovisible23)说明范围滚动；[上游 TextFieldPattern](https://github.com/openharmony/arkui_ace_engine/blob/master/frameworks/core/components_ng/pattern/text_field/text_field_pattern.cpp) 的 CalculateScrollDestination 专门处理 start==end 的 caret 范围。参数使用原生 index，不重算 UTF16 字符位置，也不依据未包含预上屏的 committed text 长度裁剪。
- 这里补齐本产品输入/布局变化后的显式可见区同步；现有代码证据没有证明 OEM 系统未自动滚动的唯一底层原因，不能冒认为系统缺陷。
- `book-caret-follow` PASS：实际父组件与真实字段实例创建并绑定 Controller，输入/父回写/selection/尺寸变化合并一帧；长中文和代理对、中间编辑、选择、IME index 超出已提交文本、清空、外部更新、旧 query、blur→refocus、卸载和无效 native 值均覆盖。Controller 为可记录的原生边界，未模拟真实横向滚动/字体像素。
- 生产改动仅 ReaderSearchField；SearchPage/Index/SearchOrchestrator 未改。未运行字体回归、其他搜索 case、HDC、构建或设备检查；最终设备表现与用户验收为 `NOT_RUN`。
