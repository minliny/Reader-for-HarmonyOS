// ReaderAccessibility — central accessibility role/description constants.
//
// HarmonyOS ArkUI exposes:
//  - .accessibilityText(String) — the visible/accessibility label.
//  - .accessibilityDescription(String) — extra context spoken after the label.
//  - .accessibilityRole(AccessibilityRoleType) — semantic role (Button, Image,
//    Toggle, Tab, etc.) that screen readers use to announce the element
//    type and pick the right gesture mapping.
//
// Most existing accessibilityText strings are good (e.g. '换源', '返回').
// The gap is accessibilityRole and accessibilityDescription. This module
// centralises the role/description pairs so each consumer node can attach
// both in a single chained call without copy-pasting magic strings.
//
// CONVENTION: descriptions start with a verb (e.g. '点击返回上一级', '点击
// 打开换源面板'). They are written in Simplified Chinese to match the
// UI label language. Reduced-motion users get the same descriptions —
// accessibility should not be gated on motion preference.

export class ReaderAccessibility {
  // Roles — HarmonyOS ArkUI AccessibilityRoleType is a global enum, no import
  // needed. Values mirror the documented enum: BUTTON, IMAGE, TOGGLE, TAB,
  // SLIDER, SEARCH, HEADER, LIST_ITEM.
  static readonly buttonRole: AccessibilityRoleType = AccessibilityRoleType.BUTTON;
  static readonly imageRole: AccessibilityRoleType = AccessibilityRoleType.IMAGE;
  static readonly toggleRole: AccessibilityRoleType = AccessibilityRoleType.TOGGLER;
  static readonly tabRole: AccessibilityRoleType = AccessibilityRoleType.TABS;
  static readonly sliderRole: AccessibilityRoleType = AccessibilityRoleType.SLIDER;
  static readonly searchRole: AccessibilityRoleType = AccessibilityRoleType.SEARCH;
  static readonly headerRole: AccessibilityRoleType = AccessibilityRoleType.TITLE_BAR;
  static readonly listItemRole: AccessibilityRoleType = AccessibilityRoleType.LIST_ITEM;

  // Descriptions — verb-first phrases spoken after the label.
  static readonly backDescription: string = '点击返回上一级';
  static readonly sourceSwitchOpenDescription: string = '点击打开换源面板，可选择同一本书的不同书源';
  static readonly sourceSwitchCloseDescription: string = '点击关闭换源窗口，放弃当前选择';
  static readonly moreOpenDescription: string = '点击打开更多菜单，包含书架缓存、章节同步等入口';
  static readonly moreCloseDescription: string = '点击关闭更多菜单';
  static readonly toggleControlsDescription: string = '点击切换控制层显示，长按正文可打开文本选择';
  static readonly dismissControlsDescription: string = '点击隐藏控制层，回到沉浸阅读';
  static readonly autoPageToggleDescription: string = '点击切换自动翻页会话，会话运行中可暂停继续';
  static readonly ttsStartDescription: string = '点击开始朗读，朗读时显示朗读胶囊和控制层运行空间';
  static readonly ttsToggleDescription: string = '点击暂停或继续朗读';
  static readonly sessionStopDescription: string = '点击停止当前阅读会话并释放运行空间';
  static readonly brightnessAutoDescription: string = '点击切换自动亮度，关闭后可手动拖动亮度条';
  static readonly chapterPrevDescription: string = '点击跳转上一章';
  static readonly chapterNextDescription: string = '点击跳转下一章';
  static readonly progressDragDescription: string = '拖动调整阅读进度百分比';
  static readonly sourceCandidateSelectDescription: string = '点击选择此书源作为换源目标，需在确认换源按钮上确认提交';
  static readonly sourceConfirmDescription: string = '点击确认换源，将使用新书源重新加载章节正文';
  static readonly textSelectionOpenDescription: string = '长按正文打开文本选择层，可复制或搜索选中文字';
  static readonly textSelectionCloseDescription: string = '点击关闭文本选择层，回到沉浸阅读';
  static readonly fullPanelExpandDescription: string = '点击展开完整控制页，包含 TTS、字体、目录等所有设置';
  static readonly readerBodyDescription: string = '阅读正文区域，左右滑动翻页，长按可选择文字';
  static readonly tocRowDescription: string = '点击跳转到该章节';
  static readonly toggleSwitchDescription: string = '点击切换开关状态';
  static readonly choiceButtonDescription: string = '点击选择当前选项';
  static readonly stepButtonDescription: string = '点击微调当前值';
  static readonly themeSwatchDescription: string = '点击选择此阅读主题';
}
