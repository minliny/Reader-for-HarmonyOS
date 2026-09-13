import { readerAppColor, readerThemeDefinition } from './ReaderThemeRegistry';
// ============================================================================
// ReaderTokens — 共享设计令牌 (对齐 Figma 语义色变量, Reader · App Color, Day 模式)。
// 分类: App / Reader / Navigation / Settings / Surface / Text / Border / Spacing /
//       Radius / Responsive / State / Motion / HarmonyOS Calibration。
// 命名对应 Figma 变量: color/runtime/paper/solid -> TOK_PAPER 等。
// 颜色从单一ThemeRegistry投影；这些兼容导出只代表Day默认值。
// 活跃UI用readerAppColor(role, appScheme)消费，不能以导出常量替代动态应用主题。
// 规则 (FIGMA_NATIVE_UI_ARCHITECTURE_PLAN §四/§十三):
//   - 每个共享 Token 标注来源 `// Figma: collection/name` 或 `// HarmonyOS calibration`。
//   - 页面禁止建立共享 Token 的二次别名; 页面直接使用语义 Token 或使用共享组件。
//   - 未定义模式保持 UNSPECIFIED, 不得复制默认值冒充完成状态。
// ============================================================================

// ----------------------------------------------------------------------------
// App — 应用级语义 (主色 / 强调色 / 主色上的文字)
// ----------------------------------------------------------------------------
// Figma: color/action/primary-dark  深绿主色
export const TOK_PRIMARY_DARK = readerAppColor('TOK_PRIMARY_DARK', 'day');
// Figma: color/action/primary       中绿主色
export const TOK_GREEN = readerAppColor('TOK_GREEN', 'day');
// Figma: color/runtime/on/primary   主色上文字
export const TOK_ON_PRIMARY = readerAppColor('TOK_ON_PRIMARY', 'day');
// HarmonyOS calibration: 书架/搜索页头主色渐变起点 (Figma 页面实测渐变起色, 非正式变量)。
// 两页共享 (BookshelfPage/SearchPage 同值 linearGradient 起点)。
export const TOK_PRIMARY_GRADIENT_START = readerAppColor('TOK_PRIMARY_GRADIENT_START', 'day');
// Figma: color/accent
export const TOK_ACCENT = readerAppColor('TOK_ACCENT', 'day');

// ----------------------------------------------------------------------------
// Text — 文字层级 (主文字 / 次级文字 / 控件文字 / 阅读文字)
// ----------------------------------------------------------------------------
// Figma: color/text/ink     主文字
export const TOK_INK = readerAppColor('TOK_INK', 'day');
// Figma: color/text/muted   次级文字
export const TOK_MUTED = readerAppColor('TOK_MUTED', 'day');
// Figma: color/control/ink
export const TOK_CONTROL_INK = readerAppColor('TOK_CONTROL_INK', 'day');

// ----------------------------------------------------------------------------
// Surface — 表面层级 (页面 / 卡片 / 面板 / 浮起 / 字段 / 透明白)
// ----------------------------------------------------------------------------
// Figma: color/runtime/paper/solid  页面背景
export const TOK_PAPER = readerAppColor('TOK_PAPER', 'day');
// Figma: color/runtime/paper/solid  同 TOK_PAPER (旧别名, 保持兼容)
export const TOK_SURFACE = readerAppColor('TOK_SURFACE', 'day');
// Figma: color/runtime/surface      rgba(255,252,248,0.90)
export const TOK_CARD_BG = readerAppColor('TOK_CARD_BG', 'day');
// Figma: color/runtime/surface/solid rgba(255,252,248,0.92)
export const TOK_CARD_BG_HI = readerAppColor('TOK_CARD_BG_HI', 'day');
// Figma: color/runtime/surface/panel rgba(255,252,248,0.62)
export const TOK_SURFACE_PANEL = readerAppColor('TOK_SURFACE_PANEL', 'day');
// Figma: color/runtime/surface/panel/soft rgba(238,230,219,0.64)
export const TOK_SURFACE_PANEL_SOFT = readerAppColor('TOK_SURFACE_PANEL_SOFT', 'day');
// Figma: color/runtime/surface/elevated rgba(255,255,255,0.78)
export const TOK_SURFACE_ELEVATED = readerAppColor('TOK_SURFACE_ELEVATED', 'day');
// Figma: color/runtime/surface/field rgba(255,248,239,0.78)
export const TOK_SURFACE_FIELD = readerAppColor('TOK_SURFACE_FIELD', 'day');
// Figma: color/runtime/surface/solid/near-opaque
export const TOK_SURFACE_SOLID_OPAQUE = readerAppColor('TOK_SURFACE_SOLID_OPAQUE', 'day');
// Figma: color/runtime/surface rgba(255,252,248,1.0) 固实表面 (Sync 卡/导入对话框/源字段)。
// 与 TOK_SURFACE_SOLID_OPAQUE(0.98) 区分: 本值为 100% 不透明。
export const TOK_SURFACE_SOLID = readerAppColor('TOK_SURFACE_SOLID', 'day');
// Figma: color/runtime/surface/translucent rgba(255,252,248,0.42)
export const TOK_SURFACE_TRANSLUCENT = readerAppColor('TOK_SURFACE_TRANSLUCENT', 'day');
// Figma: color/control/field/surface rgba(255,248,239,0.82)
export const TOK_FIELD_SURFACE = readerAppColor('TOK_FIELD_SURFACE', 'day');
// Figma: color/runtime/primary/bg rgba(45,74,62,0.12)
export const TOK_PRIMARY_BG = readerAppColor('TOK_PRIMARY_BG', 'day');
// Figma: color/runtime/primary/strong rgba(45,74,62,0.28)
export const TOK_PRIMARY_STRONG = readerAppColor('TOK_PRIMARY_STRONG', 'day');

// ----------------------------------------------------------------------------
// Border — 描边 / 分割线
// ----------------------------------------------------------------------------
// Figma: color/border/default  卡片描边
export const TOK_BORDER = readerAppColor('TOK_BORDER', 'day');
// Figma: color/settings/row-divider rgba(180,166,151,0.22)
export const TOK_ROW_DIVIDER = readerAppColor('TOK_ROW_DIVIDER', 'day');
// Figma: color/runtime/line rgba(180,166,151,0.18)
export const TOK_LINE = readerAppColor('TOK_LINE', 'day');
// Figma: color/runtime/line/strong rgba(180,166,151,0.34)
export const TOK_LINE_STRONG = readerAppColor('TOK_LINE_STRONG', 'day');
// Figma: color/runtime/line/hard rgba(190,174,156,0.40)
export const TOK_LINE_HARD = readerAppColor('TOK_LINE_HARD', 'day');
// Figma: color/runtime/line/book-detail rgba(180,166,151,0.28) — LocalBookDetail 章节行顶分隔
export const TOK_CHAPTER_DIVIDER = readerAppColor('TOK_CHAPTER_DIVIDER', 'day');
// Figma: color/runtime/line/book-detail-strong rgba(180,166,151,0.42) — LocalBookDetail 操作栏按钮边
export const TOK_ACTION_DIVIDER = readerAppColor('TOK_ACTION_DIVIDER', 'day');
// Figma: color/runtime/primary/soft rgba(45,74,62,0.10)
export const TOK_PRIMARY_SOFT = readerAppColor('TOK_PRIMARY_SOFT', 'day');
// Figma: color/runtime/primary/border rgba(45,74,62,0.42)
export const TOK_PRIMARY_BORDER = readerAppColor('TOK_PRIMARY_BORDER', 'day');

// ----------------------------------------------------------------------------
// Navigation — 主导航专用
// ----------------------------------------------------------------------------
// Figma: color/navigation/bottom-bg
export const TOK_BOTTOM_BG = readerAppColor('TOK_BOTTOM_BG', 'day');

// ----------------------------------------------------------------------------
// Settings — 设置页专用
// ----------------------------------------------------------------------------
// Figma: color/meta/bg
export const TOK_META_BG = readerAppColor('TOK_META_BG', 'day');
// HarmonyOS calibration: 设置图标软底 rgba(35,121,164,0.09)。CategoryRow 图标盒与
// SettingsPage iconBox/dangerRow 共用单源 (此前两处重复定义 #172379A4)。
export const TOK_SETTING_ICON_BG = readerAppColor('TOK_SETTING_ICON_BG', 'day');
// HarmonyOS calibration: 设置内联动作按钮底 rgba(35,121,164,0.10)。
export const TOK_SETTING_ACTION_BG = readerAppColor('TOK_SETTING_ACTION_BG', 'day');
// HarmonyOS calibration: 首页顶部栏 (AppTopBar) 水平内边距 (Figma 标题定位 x:20)。
export const TOK_HOME_TOP_BAR_INSET = 20;

// ----------------------------------------------------------------------------
// Spacing — 间距刻度 (space/*)
// ----------------------------------------------------------------------------
// Figma: space/xs
export const TOK_SPACE_XS = 8;
// Figma: space/sm (≈ control/gap)
export const TOK_SPACE_SM = 12;
// Figma: space/md (≈ screen/padding)
export const TOK_SPACE_MD = 16;
// Figma: space/lg
export const TOK_SPACE_LG = 24;
// Figma: space/xl
export const TOK_SPACE_XL = 48;
// Figma: space/card/padding
export const TOK_SPACE_CARD_PADDING = 14;
// Figma: space/control/inline
export const TOK_SPACE_CONTROL_INLINE = 10;
// Figma: space/control/row/block
export const TOK_SPACE_ROW_BLOCK = 4;

// ----------------------------------------------------------------------------
// Radius — 圆角刻度 (runtime/radius/*)
// ----------------------------------------------------------------------------
// Figma: runtime/radius/sm
export const TOK_RADIUS_SM = 6;
// Figma: runtime/radius/md
export const TOK_RADIUS_MD = 8;
// Figma: runtime/radius/lg
export const TOK_RADIUS_LG = 12;
// Figma: runtime/radius/xl
export const TOK_RADIUS_XL = 24;
// Figma: runtime/radius/pill
export const TOK_RADIUS_PILL = 999;

// ----------------------------------------------------------------------------
// Responsive — 响应式参数 (内容屏边距 / 内容最大宽度)
// ----------------------------------------------------------------------------
// HarmonyOS calibration: 屏边距 19 (Figma 变量 screen/padding=16, 但节点实测用 19。
// 该值为节点实测/校准值, 非正式 Figma Variable 来源, 与 TOK_ON_* 等 Variable 绑定区分)。
export const TOK_SCREEN_INSET = 19;
// Figma: 内容列宽 (Phone 390−2×19)
export const TOK_CONTENT_MAX_W_PHONE = 352;
// Figma: 内容列宽 — 子页档 (无左 rail, 19px 边距; 实测 SourceMgmt 722 / Sync·BookDetail·WebDAV 720)。
// 兼作大屏 maxWidth cap。区别于 rail 档 620。
export const TOK_CONTENT_MAX_W_TABLET = 720;
// Figma: 内容列宽 — rail 档 (主 tab 带左侧 BottomNav rail, 实测 Bookshelf/Discover/RSS 内容列 620)。
// Discover 代码原 722 为 bug, 已纠正到 620。
export const TOK_CONTENT_RAIL_W_TABLET = 620;

// ----------------------------------------------------------------------------
// State — 状态色 (危险 / 成功)
// ----------------------------------------------------------------------------
// Figma: color/runtime/danger
export const TOK_DANGER = readerAppColor('TOK_DANGER', 'day');

// ----------------------------------------------------------------------------
// Motion — 动效参数
// 动效的 duration/easing 不在此列 token, 统一注册于 ./MotionSpec.ets
// (权威源 = Figma "25 · Motion Reference" MR1 Production Motion Contract)。
// 此分类保留 UNSPECIFIED, 避免 token 与注册表双份权威。
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Reader — 阅读调色板 (Reading Palette/Reading Scheme, 阅读层语义色)
// 此前内联于 ReaderControlPanel 的 RC_* 常量, 现抽取为共享 token 供全部阅读浮层复用。
// ----------------------------------------------------------------------------
// Figma: reading ink  阅读控制层浮层文字 (dark surface 上次级文字)。
// 与正文 TOK_READ_BODY_INK (#2B241D) 区分: 浮层较浅。
export const TOK_READ_INK = readerAppColor('TOK_READ_INK', 'day');
// Figma: reading/palette/ink/day (Paper mode)  阅读正文 ink。
// 页面级正文 #2B241D 收敛至此 (ReadingSurface 章节/正文、ReadingExperience 测量树、
// CandidateRow 非当前行书名)。
export const TOK_READ_BODY_INK = readerThemeDefinition('paper').ink;
// Figma: reading muted  阅读次级文字
export const TOK_READ_MUTED = readerAppColor('TOK_READ_MUTED', 'day');
// Figma: 目录未读章节标题 (make `unread` state, #8a7d6e)
export const TOK_READ_UNREAD = readerAppColor('TOK_READ_UNREAD', 'day');
// Figma: reading primary  阅读主色 (teal)
export const TOK_READ_PRIMARY = readerAppColor('TOK_READ_PRIMARY', 'day');
// Figma: reading icon  阅读图标
export const TOK_READ_ICON = readerAppColor('TOK_READ_ICON', 'day');
// Figma: reading handle  阅读手柄
export const TOK_READ_HANDLE = readerAppColor('TOK_READ_HANDLE', 'day');
// Figma: reading active soft  阅读 active 软底
export const TOK_READ_ACTIVE_SOFT = readerAppColor('TOK_READ_ACTIVE_SOFT', 'day');
// Figma: reading disabled bg  阅读禁用底
export const TOK_READ_DISABLED_BG = readerAppColor('TOK_READ_DISABLED_BG', 'day');
// Figma: reading surface  阅读表面
export const TOK_READ_SURFACE = readerAppColor('TOK_READ_SURFACE', 'day');
// Figma: reading elevated  阅读浮起
export const TOK_READ_ELEVATED = readerAppColor('TOK_READ_ELEVATED', 'day');
// Figma: reading/immersive/meta (`Reader/ImmersiveInfo`, node 654:693).
// Page chrome is intentionally independent from the user-selected body ink.
export const TOK_READ_IMMERSIVE_META = readerThemeDefinition('paper').chromeMeta;
// Figma night-mode semantic counterpart. Kept independent so page chrome can
// follow the paper scheme without inheriting the configurable body font role.
export const TOK_READ_IMMERSIVE_META_NIGHT = readerThemeDefinition('paperNight').chromeMeta;

// ----------------------------------------------------------------------------
// Source Switch — 换源浮窗专用 (SourceSwitchWindow 共享组件此前内联, 现抽取)
// ----------------------------------------------------------------------------
// Figma: source-switch window surface  换源窗表面
export const TOK_SS_WINDOW_BG = readerAppColor('TOK_SS_WINDOW_BG', 'day');
// Figma: source-switch window border rgba(155,132,102,0.24)
export const TOK_SS_WINDOW_BORDER = readerAppColor('TOK_SS_WINDOW_BORDER', 'day');
// Figma: source-switch muted text  排序/关闭字形次级文字
export const TOK_SS_MUTED = readerAppColor('TOK_SS_MUTED', 'day');
// Figma: source-switch footer count text  底部书源计数
export const TOK_SS_FOOTER_TEXT = readerAppColor('TOK_SS_FOOTER_TEXT', 'day');
// Figma: source-switch close button pill rgba(238,230,219,0.42)
export const TOK_SS_CLOSE_BG = readerAppColor('TOK_SS_CLOSE_BG', 'day');
// Figma: source-switch sort pill rgba(155,132,102,0.10)
export const TOK_SS_SORT_PILL_BG = readerAppColor('TOK_SS_SORT_PILL_BG', 'day');
// Figma: source-switch column header rgba(155,132,102,0.05)
export const TOK_SS_COLUMN_HEADER_BG = readerAppColor('TOK_SS_COLUMN_HEADER_BG', 'day');

// ----------------------------------------------------------------------------
// HarmonyOS Calibration — 平台局部校准 (不回写 Figma, 不扩散, 不冒充设计参数)
// ----------------------------------------------------------------------------
// HarmonyOS calibration: Figma 0.556px 在 ArkUI 栅格化后几乎消失, 提到 1vp
// 保证实际像素覆盖 (alpha 保持对应 line token)。
export const TOK_BORDER_W = 1;
