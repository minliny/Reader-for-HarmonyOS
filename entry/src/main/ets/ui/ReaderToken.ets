// Reader for HarmonyOS - L0 Contract Token Registry
// Phase 1.5: 把 token.fixtures.json 的全部 token 作为运行时常量,作为 color.json/ReaderTypography/ReaderMotion 的唯一数据源。
// 任何新增 token 必须先在 Reader UI/contracts/token.schema.json 添加后重新生成。
import { Token, TokenCategory } from '../contract';

// ─── Color Token(16 个,ARGB byte order,与 color.json 一致)───
export class ReaderColorToken {
  static readonly paper: string = '#FFFFF8F4';
  static readonly paperBright: string = '#FFFFF8F1';
  static readonly surface: string = '#E0FFFFFF';
  static readonly surfaceSoft: string = '#B8FFFCF8';
  static readonly ink: string = '#FF1F1B17';
  static readonly controlInk: string = '#FF41484C';
  static readonly muted: string = '#FF756F69';
  static readonly border: string = '#FFC1C7CD';
  static readonly primary: string = '#FF366179';
  static readonly primaryDark: string = '#FF274F66';
  static readonly accent: string = '#FFF48B13';
  static readonly bottomBarBg: string = '#FFFBF2EB';
  static readonly floatingControlBg: string = '#FFFBF2EB';
  static readonly floatingControlBgAlt: string = '#FFEAE1DA';
  static readonly metaBg: string = '#FFF5ECE6';
  static readonly rssUnread: string = '#FF2F6F93';
}

// ─── Font Token(2 个)───
export class ReaderFontToken {
  /** --reader-ds-font-sans: -apple-system, BlinkMacSystemFont, ... */
  static readonly sans: string = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif';
  /** --reader-ds-font-serif: "Songti SC", "STSong", "Noto Serif CJK SC", ... */
  static readonly serif: string = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", serif';
}

// ─── Type Token(7 个,数值已剥离 px 单位)───
export class ReaderTypeToken {
  /** --reader-ds-type-app-title-size: 20px */
  static readonly appTitleSize: number = 20;
  /** --reader-ds-type-page-title-size: 20px */
  static readonly pageTitleSize: number = 20;
  /** --reader-ds-type-section-title-size: 15px */
  static readonly sectionTitleSize: number = 15;
  /** --reader-ds-type-book-title-size: 14px */
  static readonly bookTitleSize: number = 14;
  /** --reader-ds-type-book-meta-size: 12px */
  static readonly bookMetaSize: number = 12;
  /** --reader-ds-type-reader-body-size: 18px */
  static readonly readerBodySize: number = 18;
  /** --reader-ds-type-reader-control-label-size: 12px */
  static readonly readerControlLabelSize: number = 12;
}

// ─── Spacing Token(11 个,数值已剥离 px 单位)───
export class ReaderSpacingToken {
  /** --reader-ds-space-xs: 8px */
  static readonly xs: number = 8;
  /** --reader-ds-space-sm: 12px */
  static readonly sm: number = 12;
  /** --reader-ds-space-md: 16px */
  static readonly md: number = 16;
  /** --reader-ds-space-lg: 24px */
  static readonly lg: number = 24;
  /** --reader-ds-space-xl: 48px */
  static readonly xl: number = 48;
  /** --reader-ds-space-screen-padding: 16px */
  static readonly screenPadding: number = 16;
  /** --reader-ds-space-card-padding: 14px */
  static readonly cardPadding: number = 14;
  /** --reader-ds-space-safe-area-top: 24px */
  static readonly safeAreaTop: number = 24;
  /** --reader-ds-space-safe-area-bottom: 14px */
  static readonly safeAreaBottom: number = 14;
  /** --reader-ds-space-safe-area-horizontal: 16px */
  static readonly safeAreaHorizontal: number = 16;
  /** --reader-ds-space-keyboard-gap: 12px */
  static readonly keyboardGap: number = 12;
}

// ─── Size Token(11 个,数值已剥离 px 单位)───
export class ReaderSizeToken {
  static readonly phoneWidth: number = 390;
  static readonly phoneHeight: number = 844;
  static readonly stackPhoneHeight: number = 878;
  static readonly flowWidth: number = 1284;
  static readonly flowMinHeight: number = 520;
  static readonly topBarHeight: number = 58;
  static readonly bottomBarHeight: number = 68;
  static readonly mainNavHeight: number = 68;
  static readonly readerBottomSheetMinHeight: number = 284;
  static readonly readerModuleNavHeight: number = 82;
  static readonly keyboardHeight: number = 320;
}

// ─── Radius Token(7 个,数值已剥离 px 单位)───
export class ReaderRadiusToken {
  static readonly small: number = 4;
  static readonly medium: number = 6;
  static readonly large: number = 8;
  static readonly card: number = 4;
  static readonly chip: number = 2;
  static readonly bottomSheet: number = 8;
  /** --reader-ds-radius-control: 999px (capsule) */
  static readonly control: number = 999;
}

// ─── Elevation Token(4 个,数值已剥离 px 单位)───
export class ReaderElevationToken {
  static readonly none: number = 0;
  static readonly subtle: number = 1;
  static readonly card: number = 2;
  static readonly overlay: number = 2;
}

// ─── Shadow Token(3 个,保留 rgba 原值)───
export class ReaderShadowToken {
  /** --reader-ds-shadow-elevated: 0 18px 46px rgba(89,70,50,0.16) */
  static readonly elevated: string = '0 18px 46px rgba(89,70,50,0.16)';
  /** --reader-ds-shadow-soft: 0 8px 26px rgba(89,70,50,0.1) */
  static readonly soft: string = '0 8px 26px rgba(89,70,50,0.1)';
  /** --reader-ds-state-focus: 0 0 0 4px rgba(54,97,121,0.22) */
  static readonly stateFocus: string = '0 0 0 4px rgba(54,97,121,0.22)';
}

// ─── Z-Index Token(7 个)───
export class ReaderZIndexToken {
  static readonly content: number = 0;
  static readonly overlay: number = 10;
  static readonly mainNav: number = 20;
  static readonly bottomSheet: number = 30;
  static readonly readerModuleNav: number = 40;
  static readonly dialog: number = 60;
  static readonly keyboard: number = 70;
}

// ─── Text Constraint Token(5 个)───
export class ReaderTextConstraintToken {
  /** --reader-ds-text-nav-label-lines: 1 */
  static readonly navLabelLines: number = 1;
  static readonly titleLines: number = 1;
  static readonly bookTitleLines: number = 2;
  /** --reader-ds-text-reader-line-length: 31ch */
  static readonly readerLineLength: number = 31;
  static readonly actionLabelLines: number = 1;
}

// ─── Motion Duration Token(40 个,数值已剥离 ms 单位)───
export class ReaderMotionDurationToken {
  static readonly firstOpen: number = 280;
  static readonly tabPress: number = 80;
  static readonly tabSelect: number = 120;
  static readonly tabSwitch: number = 160;
  static readonly buttonPress: number = 80;
  static readonly buttonActivate: number = 120;
  static readonly toggleSwitch: number = 140;
  static readonly chipSelect: number = 120;
  static readonly filterCommit: number = 160;
  static readonly numericCommit: number = 120;
  static readonly inputFocus: number = 120;
  static readonly searchState: number = 160;
  static readonly feedbackToast: number = 180;
  static readonly stateReplace: number = 160;
  static readonly selectionToolbar: number = 160;
  static readonly dropdownPress: number = 80;
  static readonly dropdownExpand: number = 160;
  static readonly dropdownCollapse: number = 120;
  static readonly dropdownSelect: number = 120;
  static readonly readerInstant: number = 0;
  static readonly readerMicro: number = 80;
  static readonly readerFast: number = 120;
  static readonly readerBase: number = 160;
  static readonly handleLongPress: number = 320;
  static readonly handleSnap: number = 120;
  static readonly panel: number = 200;
  static readonly pageTurn: number = 220;
  static readonly readerEntry: number = 240;
  static readonly sessionReturn: number = 200;
  static readonly runningSpace: number = 180;
  static readonly capsuleEnter: number = 160;
  static readonly capsuleControl: number = 120;
  static readonly capsuleTick: number = 120;
  static readonly voicePulse: number = 960;
  static readonly overlay: number = 240;
  static readonly loadingSpin: number = 800;
  static readonly interruptSettle: number = 80;
  static readonly viewportReshape: number = 240;
  static readonly orientationFreeze: number = 80;
  static readonly orientationSettle: number = 240;
}

// ─── Motion Easing Token(4 个,字符串值)───
export class ReaderMotionEasingToken {
  /** --reader-ds-motion-easing-standard: ease */
  static readonly standard: string = 'ease';
  /** --reader-ds-motion-easing-enter: ease-out */
  static readonly enter: string = 'ease-out';
  /** --reader-ds-motion-easing-exit: ease-in */
  static readonly exit: string = 'ease-in';
  /** --reader-ds-motion-easing-reshape: ease-in-out */
  static readonly reshape: string = 'ease-in-out';
}

// ─── 完整 Token 注册表(与 token.fixtures.json 一致,用于契约一致性检查)───
export class ReaderTokenRegistry {
  static readonly tokens: Token[] = [
    // Color (16)
    { name: '--reader-ds-color-paper', category: 'color', value: '#fff8f4' },
    { name: '--reader-ds-color-paper-bright', category: 'color', value: '#fff8f1' },
    { name: '--reader-ds-color-surface', category: 'color', value: 'rgba(255,255,255,0.88)' },
    { name: '--reader-ds-color-surface-soft', category: 'color', value: 'rgba(255,252,248,0.72)' },
    { name: '--reader-ds-color-ink', category: 'color', value: '#1f1b17' },
    { name: '--reader-ds-color-control-ink', category: 'color', value: '#41484c' },
    { name: '--reader-ds-color-muted', category: 'color', value: '#756f69' },
    { name: '--reader-ds-color-border', category: 'color', value: '#c1c7cd' },
    { name: '--reader-ds-color-primary', category: 'color', value: '#366179' },
    { name: '--reader-ds-color-primary-dark', category: 'color', value: '#274f66' },
    { name: '--reader-ds-color-accent', category: 'color', value: '#f48b13' },
    { name: '--reader-ds-color-bottom-bar-bg', category: 'color', value: '#fbf2eb' },
    { name: '--reader-ds-color-floating-control-bg', category: 'color', value: '#fbf2eb' },
    { name: '--reader-ds-color-floating-control-bg-alt', category: 'color', value: '#eae1da' },
    { name: '--reader-ds-color-meta-bg', category: 'color', value: '#f5ece6' },
    { name: '--reader-ds-color-rss-unread', category: 'color', value: '#2F6F93' },
    // Font (2)
    { name: '--reader-ds-font-sans', category: 'font', value: ReaderFontToken.sans },
    { name: '--reader-ds-font-serif', category: 'font', value: ReaderFontToken.serif },
    // Type (7)
    { name: '--reader-ds-type-app-title-size', category: 'type', value: `${ReaderTypeToken.appTitleSize}px` },
    { name: '--reader-ds-type-page-title-size', category: 'type', value: `${ReaderTypeToken.pageTitleSize}px` },
    { name: '--reader-ds-type-section-title-size', category: 'type', value: `${ReaderTypeToken.sectionTitleSize}px` },
    { name: '--reader-ds-type-book-title-size', category: 'type', value: `${ReaderTypeToken.bookTitleSize}px` },
    { name: '--reader-ds-type-book-meta-size', category: 'type', value: `${ReaderTypeToken.bookMetaSize}px` },
    { name: '--reader-ds-type-reader-body-size', category: 'type', value: `${ReaderTypeToken.readerBodySize}px` },
    { name: '--reader-ds-type-reader-control-label-size', category: 'type', value: `${ReaderTypeToken.readerControlLabelSize}px` },
    // Spacing (11)
    { name: '--reader-ds-space-xs', category: 'spacing', value: `${ReaderSpacingToken.xs}px` },
    { name: '--reader-ds-space-sm', category: 'spacing', value: `${ReaderSpacingToken.sm}px` },
    { name: '--reader-ds-space-md', category: 'spacing', value: `${ReaderSpacingToken.md}px` },
    { name: '--reader-ds-space-lg', category: 'spacing', value: `${ReaderSpacingToken.lg}px` },
    { name: '--reader-ds-space-xl', category: 'spacing', value: `${ReaderSpacingToken.xl}px` },
    { name: '--reader-ds-space-screen-padding', category: 'spacing', value: `${ReaderSpacingToken.screenPadding}px` },
    { name: '--reader-ds-space-card-padding', category: 'spacing', value: `${ReaderSpacingToken.cardPadding}px` },
    { name: '--reader-ds-space-safe-area-top', category: 'spacing', value: `${ReaderSpacingToken.safeAreaTop}px` },
    { name: '--reader-ds-space-safe-area-bottom', category: 'spacing', value: `${ReaderSpacingToken.safeAreaBottom}px` },
    { name: '--reader-ds-space-safe-area-horizontal', category: 'spacing', value: `${ReaderSpacingToken.safeAreaHorizontal}px` },
    { name: '--reader-ds-space-keyboard-gap', category: 'spacing', value: `${ReaderSpacingToken.keyboardGap}px` },
    // Size (11)
    { name: '--reader-ds-size-phone-width', category: 'size', value: `${ReaderSizeToken.phoneWidth}px` },
    { name: '--reader-ds-size-phone-height', category: 'size', value: `${ReaderSizeToken.phoneHeight}px` },
    { name: '--reader-ds-size-stack-phone-height', category: 'size', value: `${ReaderSizeToken.stackPhoneHeight}px` },
    { name: '--reader-ds-size-flow-width', category: 'size', value: `${ReaderSizeToken.flowWidth}px` },
    { name: '--reader-ds-size-flow-min-height', category: 'size', value: `${ReaderSizeToken.flowMinHeight}px` },
    { name: '--reader-ds-size-top-bar-height', category: 'size', value: `${ReaderSizeToken.topBarHeight}px` },
    { name: '--reader-ds-size-bottom-bar-height', category: 'size', value: `${ReaderSizeToken.bottomBarHeight}px` },
    { name: '--reader-ds-size-main-nav-height', category: 'size', value: `${ReaderSizeToken.mainNavHeight}px` },
    { name: '--reader-ds-size-reader-bottom-sheet-min-height', category: 'size', value: `${ReaderSizeToken.readerBottomSheetMinHeight}px` },
    { name: '--reader-ds-size-reader-module-nav-height', category: 'size', value: `${ReaderSizeToken.readerModuleNavHeight}px` },
    { name: '--reader-ds-size-keyboard-height', category: 'size', value: `${ReaderSizeToken.keyboardHeight}px` },
    // Radius (7)
    { name: '--reader-ds-radius-small', category: 'radius', value: `${ReaderRadiusToken.small}px` },
    { name: '--reader-ds-radius-medium', category: 'radius', value: `${ReaderRadiusToken.medium}px` },
    { name: '--reader-ds-radius-large', category: 'radius', value: `${ReaderRadiusToken.large}px` },
    { name: '--reader-ds-radius-card', category: 'radius', value: `${ReaderRadiusToken.card}px` },
    { name: '--reader-ds-radius-chip', category: 'radius', value: `${ReaderRadiusToken.chip}px` },
    { name: '--reader-ds-radius-bottom-sheet', category: 'radius', value: `${ReaderRadiusToken.bottomSheet}px` },
    { name: '--reader-ds-radius-control', category: 'radius', value: `${ReaderRadiusToken.control}px` },
    // Elevation (4)
    { name: '--reader-ds-elevation-none', category: 'elevation', value: `${ReaderElevationToken.none}px` },
    { name: '--reader-ds-elevation-subtle', category: 'elevation', value: `${ReaderElevationToken.subtle}px` },
    { name: '--reader-ds-elevation-card', category: 'elevation', value: `${ReaderElevationToken.card}px` },
    { name: '--reader-ds-elevation-overlay', category: 'elevation', value: `${ReaderElevationToken.overlay}px` },
    // Shadow (3)
    { name: '--reader-ds-shadow-elevated', category: 'shadow', value: ReaderShadowToken.elevated },
    { name: '--reader-ds-shadow-soft', category: 'shadow', value: ReaderShadowToken.soft },
    { name: '--reader-ds-state-focus', category: 'shadow', value: ReaderShadowToken.stateFocus },
    // Z-Index (7)
    { name: '--reader-ds-z-content', category: 'z-index', value: `${ReaderZIndexToken.content}` },
    { name: '--reader-ds-z-overlay', category: 'z-index', value: `${ReaderZIndexToken.overlay}` },
    { name: '--reader-ds-z-main-nav', category: 'z-index', value: `${ReaderZIndexToken.mainNav}` },
    { name: '--reader-ds-z-bottom-sheet', category: 'z-index', value: `${ReaderZIndexToken.bottomSheet}` },
    { name: '--reader-ds-z-reader-module-nav', category: 'z-index', value: `${ReaderZIndexToken.readerModuleNav}` },
    { name: '--reader-ds-z-dialog', category: 'z-index', value: `${ReaderZIndexToken.dialog}` },
    { name: '--reader-ds-z-keyboard', category: 'z-index', value: `${ReaderZIndexToken.keyboard}` },
    // Text Constraint (5)
    { name: '--reader-ds-text-nav-label-lines', category: 'text-constraint', value: `${ReaderTextConstraintToken.navLabelLines}` },
    { name: '--reader-ds-text-title-lines', category: 'text-constraint', value: `${ReaderTextConstraintToken.titleLines}` },
    { name: '--reader-ds-text-book-title-lines', category: 'text-constraint', value: `${ReaderTextConstraintToken.bookTitleLines}` },
    { name: '--reader-ds-text-reader-line-length', category: 'text-constraint', value: `${ReaderTextConstraintToken.readerLineLength}ch` },
    { name: '--reader-ds-text-action-label-lines', category: 'text-constraint', value: `${ReaderTextConstraintToken.actionLabelLines}` },
    // Motion Duration (40)
    { name: '--reader-ds-motion-duration-firstOpen', category: 'motion-duration', value: `${ReaderMotionDurationToken.firstOpen}ms` },
    { name: '--reader-ds-motion-duration-tabPress', category: 'motion-duration', value: `${ReaderMotionDurationToken.tabPress}ms` },
    { name: '--reader-ds-motion-duration-tabSelect', category: 'motion-duration', value: `${ReaderMotionDurationToken.tabSelect}ms` },
    { name: '--reader-ds-motion-duration-tabSwitch', category: 'motion-duration', value: `${ReaderMotionDurationToken.tabSwitch}ms` },
    { name: '--reader-ds-motion-duration-buttonPress', category: 'motion-duration', value: `${ReaderMotionDurationToken.buttonPress}ms` },
    { name: '--reader-ds-motion-duration-buttonActivate', category: 'motion-duration', value: `${ReaderMotionDurationToken.buttonActivate}ms` },
    { name: '--reader-ds-motion-duration-toggleSwitch', category: 'motion-duration', value: `${ReaderMotionDurationToken.toggleSwitch}ms` },
    { name: '--reader-ds-motion-duration-chipSelect', category: 'motion-duration', value: `${ReaderMotionDurationToken.chipSelect}ms` },
    { name: '--reader-ds-motion-duration-filterCommit', category: 'motion-duration', value: `${ReaderMotionDurationToken.filterCommit}ms` },
    { name: '--reader-ds-motion-duration-numericCommit', category: 'motion-duration', value: `${ReaderMotionDurationToken.numericCommit}ms` },
    { name: '--reader-ds-motion-duration-inputFocus', category: 'motion-duration', value: `${ReaderMotionDurationToken.inputFocus}ms` },
    { name: '--reader-ds-motion-duration-searchState', category: 'motion-duration', value: `${ReaderMotionDurationToken.searchState}ms` },
    { name: '--reader-ds-motion-duration-feedbackToast', category: 'motion-duration', value: `${ReaderMotionDurationToken.feedbackToast}ms` },
    { name: '--reader-ds-motion-duration-stateReplace', category: 'motion-duration', value: `${ReaderMotionDurationToken.stateReplace}ms` },
    { name: '--reader-ds-motion-duration-selectionToolbar', category: 'motion-duration', value: `${ReaderMotionDurationToken.selectionToolbar}ms` },
    { name: '--reader-ds-motion-duration-dropdownPress', category: 'motion-duration', value: `${ReaderMotionDurationToken.dropdownPress}ms` },
    { name: '--reader-ds-motion-duration-dropdownExpand', category: 'motion-duration', value: `${ReaderMotionDurationToken.dropdownExpand}ms` },
    { name: '--reader-ds-motion-duration-dropdownCollapse', category: 'motion-duration', value: `${ReaderMotionDurationToken.dropdownCollapse}ms` },
    { name: '--reader-ds-motion-duration-dropdownSelect', category: 'motion-duration', value: `${ReaderMotionDurationToken.dropdownSelect}ms` },
    { name: '--reader-ds-motion-duration-readerInstant', category: 'motion-duration', value: `${ReaderMotionDurationToken.readerInstant}ms` },
    { name: '--reader-ds-motion-duration-readerMicro', category: 'motion-duration', value: `${ReaderMotionDurationToken.readerMicro}ms` },
    { name: '--reader-ds-motion-duration-readerFast', category: 'motion-duration', value: `${ReaderMotionDurationToken.readerFast}ms` },
    { name: '--reader-ds-motion-duration-readerBase', category: 'motion-duration', value: `${ReaderMotionDurationToken.readerBase}ms` },
    { name: '--reader-ds-motion-duration-handleLongPress', category: 'motion-duration', value: `${ReaderMotionDurationToken.handleLongPress}ms` },
    { name: '--reader-ds-motion-duration-handleSnap', category: 'motion-duration', value: `${ReaderMotionDurationToken.handleSnap}ms` },
    { name: '--reader-ds-motion-duration-panel', category: 'motion-duration', value: `${ReaderMotionDurationToken.panel}ms` },
    { name: '--reader-ds-motion-duration-pageTurn', category: 'motion-duration', value: `${ReaderMotionDurationToken.pageTurn}ms` },
    { name: '--reader-ds-motion-duration-readerEntry', category: 'motion-duration', value: `${ReaderMotionDurationToken.readerEntry}ms` },
    { name: '--reader-ds-motion-duration-sessionReturn', category: 'motion-duration', value: `${ReaderMotionDurationToken.sessionReturn}ms` },
    { name: '--reader-ds-motion-duration-runningSpace', category: 'motion-duration', value: `${ReaderMotionDurationToken.runningSpace}ms` },
    { name: '--reader-ds-motion-duration-capsuleEnter', category: 'motion-duration', value: `${ReaderMotionDurationToken.capsuleEnter}ms` },
    { name: '--reader-ds-motion-duration-capsuleControl', category: 'motion-duration', value: `${ReaderMotionDurationToken.capsuleControl}ms` },
    { name: '--reader-ds-motion-duration-capsuleTick', category: 'motion-duration', value: `${ReaderMotionDurationToken.capsuleTick}ms` },
    { name: '--reader-ds-motion-duration-voicePulse', category: 'motion-duration', value: `${ReaderMotionDurationToken.voicePulse}ms` },
    { name: '--reader-ds-motion-duration-overlay', category: 'motion-duration', value: `${ReaderMotionDurationToken.overlay}ms` },
    { name: '--reader-ds-motion-duration-loadingSpin', category: 'motion-duration', value: `${ReaderMotionDurationToken.loadingSpin}ms` },
    { name: '--reader-ds-motion-duration-interruptSettle', category: 'motion-duration', value: `${ReaderMotionDurationToken.interruptSettle}ms` },
    { name: '--reader-ds-motion-duration-viewportReshape', category: 'motion-duration', value: `${ReaderMotionDurationToken.viewportReshape}ms` },
    { name: '--reader-ds-motion-duration-orientationFreeze', category: 'motion-duration', value: `${ReaderMotionDurationToken.orientationFreeze}ms` },
    { name: '--reader-ds-motion-duration-orientationSettle', category: 'motion-duration', value: `${ReaderMotionDurationToken.orientationSettle}ms` },
    // Motion Easing (4)
    { name: '--reader-ds-motion-easing-standard', category: 'motion-easing', value: ReaderMotionEasingToken.standard },
    { name: '--reader-ds-motion-easing-enter', category: 'motion-easing', value: ReaderMotionEasingToken.enter },
    { name: '--reader-ds-motion-easing-exit', category: 'motion-easing', value: ReaderMotionEasingToken.exit },
    { name: '--reader-ds-motion-easing-reshape', category: 'motion-easing', value: ReaderMotionEasingToken.reshape }
  ];

  /** 按分类查询 token 列表 */
  static byCategory(category: TokenCategory): Token[] {
    return ReaderTokenRegistry.tokens.filter((t: Token) => t.category === category);
  }

  /** 按 name 查询单个 token */
  static byName(name: string): Token | undefined {
    return ReaderTokenRegistry.tokens.find((t: Token) => t.name === name);
  }
}
