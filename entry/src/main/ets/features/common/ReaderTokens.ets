// 核心设计令牌 —— 对齐 Figma 语义色变量 (Reader · App Color, Day 模式)。
// 命名对应 Figma 变量: color/runtime/paper/solid -> TOK_PAPER 等。
// 颜色为 AARRGGBB 十六进制。页面应别名引用这些令牌;仅当某值在该页确有差异时才保留页内值。
export const TOK_PAPER = '#F8F4EC';            // color/runtime/paper/solid 页面背景
export const TOK_SURFACE = '#F8F4EC';          // 同 TOK_PAPER (旧别名, 保持兼容)
export const TOK_INK = '#1F1B17';              // color/text/ink 主文字
export const TOK_MUTED = '#756F69';            // color/text/muted 次级文字
export const TOK_CONTROL_INK = '#41484C';      // color/control/ink
export const TOK_BORDER = '#C1C7CD';           // color/border/default 卡片描边
export const TOK_CARD_BG = '#E6FFFCF8';        // color/runtime/surface rgba(255,252,248,0.90)
export const TOK_CARD_BG_HI = '#EBFFFCF8';     // color/runtime/surface/solid rgba(255,252,248,0.92)
export const TOK_PRIMARY_DARK = '#1F3528';     // color/action/primary-dark 深绿主色
export const TOK_GREEN = '#2D4A3E';            // color/action/primary 中绿主色
export const TOK_ON_PRIMARY = '#FFFAF4';       // color/runtime/on/primary 主色上文字
export const TOK_ACCENT = '#F48B13';           // color/accent
export const TOK_DANGER = '#D62222';           // color/runtime/danger
export const TOK_FOREST = '#367A4D';           // color/runtime/forest
export const TOK_ROW_DIVIDER = '#38B4A697';    // color/settings/row-divider rgba(180,166,151,0.22)
export const TOK_LINE = '#2E9B8466';           // color/runtime/line rgba(180,166,151,0.18)
export const TOK_LINE_STRONG = '#57B4A697';    // color/runtime/line/strong rgba(180,166,151,0.34)
export const TOK_LINE_HARD = '#66BEAE9C';      // color/runtime/line/hard rgba(190,174,156,0.40)
export const TOK_PRIMARY_SOFT = '#172D4A3E';   // color/runtime/primary/soft
export const TOK_PRIMARY_BG = '#1F2D4A3E';     // color/runtime/primary/bg
export const TOK_PRIMARY_STRONG = '#472D4A3E'; // color/runtime/primary/strong
export const TOK_PRIMARY_BORDER = '#6B2D4A3E'; // color/runtime/primary/border
export const TOK_SURFACE_PANEL = '#9EFFFCF8';  // color/runtime/surface/panel rgba(255,252,248,0.62)
export const TOK_SURFACE_PANEL_SOFT = '#A3EEE6DB'; // color/runtime/surface/panel/soft rgba(238,230,219,0.64)
export const TOK_SURFACE_ELEVATED = '#C7FFFFFF';   // color/runtime/surface/elevated rgba(255,255,255,0.78)
export const TOK_SURFACE_FIELD = '#C7FFF8EF';  // color/runtime/surface/field rgba(255,248,239,0.78)
export const TOK_SURFACE_SOLID_OPAQUE = '#FAFFFCF8'; // 近不透明 surface
export const TOK_SURFACE_TRANSLUCENT = '#6BFFFCF8'; // color/runtime/surface/translucent rgba(255,252,248,0.42)
export const TOK_FIELD_SURFACE = '#D1FFF8EF';  // color/control/field/surface rgba(255,248,239,0.82)
export const TOK_BOTTOM_BG = '#FBF2EB';        // color/navigation/bottom-bg
export const TOK_META_BG = '#F5ECE6';          // color/meta/bg

// 间距令牌 —— 对齐 Figma Dimensions (space/* 刻度)。页面 padding/margin/space 应引用。
export const TOK_SPACE_XS = 8;              // space/xs
export const TOK_SPACE_SM = 12;             // space/sm (≈ control/gap)
export const TOK_SPACE_MD = 16;             // space/md (≈ screen/padding)
export const TOK_SPACE_LG = 24;             // space/lg
export const TOK_SPACE_XL = 48;             // space/xl
export const TOK_SPACE_CARD_PADDING = 14;   // space/card/padding
export const TOK_SPACE_CONTROL_INLINE = 10; // space/control/inline
export const TOK_SPACE_ROW_BLOCK = 4;       // space/control/row/block
export const TOK_SCREEN_INSET = 19;         // 内容屏边距 (本地 Figma 节点实测; 变量 screen/padding=16 但节点用 19)
// 圆角令牌 —— 对齐 runtime/radius 刻度。
export const TOK_RADIUS_SM = 6;             // runtime/radius/sm
export const TOK_RADIUS_MD = 8;             // runtime/radius/md
export const TOK_RADIUS_LG = 12;            // runtime/radius/lg
export const TOK_RADIUS_XL = 24;            // runtime/radius/xl
export const TOK_RADIUS_PILL = 999;         // runtime/radius/pill

// 阅读调色板 —— 对齐 Figma Reading Palette/Reading Scheme (阅读层语义色)。
// 此前内联于 ReaderControlPanel 的 RC_* 常量, 现抽取为共享 token 供全部阅读浮层复用。
export const TOK_READ_INK = '#332C25';            // 阅读主文字
export const TOK_READ_MUTED = '#5B5046';          // 阅读次级文字
export const TOK_READ_PRIMARY = '#2F6373';        // 阅读主色 (teal)
export const TOK_READ_ICON = '#4D463F';           // 阅读图标
export const TOK_READ_HANDLE = '#B9AD9F';         // 阅读手柄
export const TOK_READ_ACTIVE_SOFT = '#142F6373';  // 阅读 active 软底
export const TOK_READ_DISABLED_BG = '#8FEEE6DB';  // 阅读禁用底
export const TOK_READ_SURFACE = '#FAFFFAF4';      // 阅读表面
export const TOK_READ_ELEVATED = '#BDFFFCF8';     // 阅读浮起
