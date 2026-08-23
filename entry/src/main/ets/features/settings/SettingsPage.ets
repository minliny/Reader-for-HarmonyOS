// Settings General — rebuilt 2026-08-05 against live Figma nodes
// 943:2897 (Phone 390×844) / 943:3369 (Tablet 760×960).
// Batch 3: 设置/偏好/行为/权限四个区块收敛到 CategorySection(Card+Heading+rows)，
// 行收敛到 CategoryRow(icon盒+label+trailing)。仅 selectRow 与 dangerRow 保留为
// 页私有 —— 下拉展开会撑高行(见下), 通用 CategoryRow 无法表达; 危险行是独立卡片。
import { SettingsShell } from '../shell/SettingsShell';
import { registerReaderFonts } from '../common/ReaderFonts';
import { ReaderToggle } from '../common/ReaderToggle';
import { ReaderSelect } from '../common/ReaderSelect';
import { ReaderSelectPanel, SelectAnchor } from '../common/ReaderSelectPanel';
import { ReaderSegmentedControl } from '../common/ReaderSegmentedControl';
import { StatusBadge } from '../common/StatusBadge';
import { CategorySection } from './CategorySection';
import { CategoryRow } from './CategoryRow';
import {
  TOK_BORDER_W,
  TOK_DANGER,
  TOK_GREEN,
  TOK_INK,
  TOK_ROW_DIVIDER,
  TOK_SETTING_ACTION_BG,
  TOK_SETTING_ICON_BG,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_SM,
} from '../common/ReaderTokens';

// 页面私有布局常量 (不属共享 token: 页面独有下拉行对齐常量)。
// Figma Article 行右内距 12 (= TOK_SPACE_SM, 直引)。
// selectRow 专用: Figma Settings/SelectTrigger (`4104:3585`) 为 34 高，
// 在 58 行内垂直居中。Phone 用右箭头，Tablet 用下/上箭头。
const SELECT_ROW_H = 58;
const SELECT_TRIGGER_H = 34;
const SELECT_TRIGGER_OFFSET = (SELECT_ROW_H - SELECT_TRIGGER_H) / 2;
// App主题 为分段控件 (Figma ThemeSegment 2114:20635), 非下拉; 标签用 Figma 原文。
const SEG_OPTIONS: string[] = ['跟随', '浅色', '深色'];

export interface SettingsSnapshot {
  autoCheckUpdate: boolean;
  tapBottomScrollTop: boolean;
  reduceMotion: boolean;
  crashLog: boolean;
}

@Component
export struct SettingsPage {
  @State private activeSection: 'home' | 'general' = 'home';

  @Prop @Watch('onSnapshotChanged') snapshot: SettingsSnapshot = {
    autoCheckUpdate: true,
    tapBottomScrollTop: true,
    reduceMotion: false,
    crashLog: true,
  };
  @Prop isTablet: boolean;
  @State private themeValue: string = SEG_OPTIONS[0];
  @State private languageValue: string = '简体中文';
  @State private startupValue: string = '书架';
  @State private animationValue: string = '标准';
  @State private autoCheckUpdateValue: boolean = true;
  @State private tapBottomScrollTopValue: boolean = true;
  @State private reduceMotionValue: boolean = false;
  @State private crashLogValue: boolean = true;
  @State private cacheActionLabel: string = '清理文字缓存';
  @State private cacheCleanupInFlight: boolean = false;
  @State private openSelect: string = '';
  // 展开面板锚点: 触发条全局坐标减去宿主 Stack 原点, 得面板相对宿主 Stack 的位置。
  // selectAnchors 为普通 map(非 @State): 逐行 onAreaChange 写入, 打开时读入 anchorX/Y。
  @State private anchorX: number = 0;
  @State private anchorY: number = 0;
  @State private originX: number = 0;
  @State private originY: number = 0;
  private selectAnchors: Record<string, SelectAnchor> = {};
  onBack: () => void = (): void => {};
  onOpenSourceManagement: () => void = (): void => {};
  onOpenRulesManagement: () => void = (): void => {};
  onOpenSync: () => void = (): void => {};
  onRssRequested: () => void = (): void => {};
  onDiscoverRequested: () => void = (): void => {};
  onClearCache: () => Promise<boolean> = async (): Promise<boolean> => false;
  onToggle: (key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog', value: boolean) => void =
    (_key: string, _value: boolean): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.syncSnapshotValues();
  }

  build() {
    SettingsShell({
      activeSection: this.activeSection,
      onSectionChange: (section: 'home' | 'general'): void => {
        this.activeSection = section;
      },
      onBack: this.onBack,
      onOpenSourceManagement: this.onOpenSourceManagement,
      onOpenSync: this.onOpenSync,
      onRssRequested: this.onRssRequested,
      onDiscoverRequested: this.onDiscoverRequested,
      showOverlay: this.openSelect !== '',
      onOverlayOriginChange: (x: number, y: number): void => {
        this.originX = x;
        this.originY = y;
      },
      // ArkUI 限制: @Builder 方法引用作 @BuilderParam 时, 方法内部再建 @Builder
      // 闭包 (CategorySection content → this.navRow) 会丢 this 绑定, 运行时崩
      // "Cannot read property bind of undefined"。改内联闭包词法捕获 this (同
      // BookshelfPage 尾随闭包 pattern), 内层 this.buildHome() 才正确绑定。
      homeContent: (): void => { this.buildHome(); },
      generalContent: (): void => { this.buildGeneral(); },
      overlayContent: (): void => { this.buildOverlay(); },
    });
  }

  @Builder
  private buildHome() {
    CategorySection({ title: '设置' }) {
      this.navRow('通用设置', $r('app.media.settings_row_general'), (): void => {
        this.activeSection = 'general';
      });
      this.navRow('书架与搜索设置', $r('app.media.settings_row_shelf_search'), (): void => {});
      this.navRow('书源管理', $r('app.media.settings_row_source'), (): void => this.onOpenSourceManagement());
      this.navRow('规则实体管理', $r('app.media.settings_row_source'), (): void => this.onOpenRulesManagement());
      this.navRow('同步与备份', $r('app.media.settings_row_sync'), (): void => this.onOpenSync());
      this.navRow('关于与反馈', $r('app.media.settings_row_about'), (): void => {});
    }
  }

  @Builder
  private buildGeneral() {
    this.preferenceCard();
    this.behaviorCard();
    this.permissionCard();
    this.dangerRow();
  }

  @Builder
  private preferenceCard() {
    CategorySection({ title: '基础偏好' }) {
      this.segmentRow('App主题', $r('app.media.settings_gen_theme'));
      this.selectRow('语言', $r('app.media.settings_gen_language'), 'language',
        ['简体中文', '繁体中文', 'English', '日本語', '한국어']);
      this.selectRow('启动时打开', $r('app.media.settings_gen_startup'), 'startup',
        ['书架', '发现', 'RSS', '设置']);
    }
  }

  @Builder
  private behaviorCard() {
    CategorySection({ title: '行为与反馈' }) {
      this.switchRow('自动检查更新', $r('app.media.settings_gen_update'), 'autoCheckUpdate');
      this.switchRow('点击当前底栏回顶部', $r('app.media.settings_gen_tap_top'), 'tapBottomScrollTop');
      this.switchRow('减少动态效果', $r('app.media.settings_gen_motion'), 'reduceMotion');
      this.switchRow('崩溃日志', $r('app.media.settings_gen_crash'), 'crashLog');
      this.selectRow('动画效果', $r('app.media.settings_gen_animation'), 'animation', ['标准', '减弱', '关闭']);
      this.cacheActionRow();
    }
  }

  @Builder
  private permissionCard() {
    CategorySection({ title: '系统权限' }) {
      this.permissionRow('文件访问', $r('app.media.settings_gen_file'), '#212B895C', '#28704E');
      this.permissionRow('通知权限', $r('app.media.settings_gen_notification'), '#24B0661D', '#8C521D');
      this.permissionRow('电池优化', $r('app.media.settings_gen_battery'), '#212379A4', TOK_GREEN);
    }
  }

  // 导航行: CategoryRow + 尾部 chevron。
  @Builder
  private navRow(label: string, icon: Resource, action: () => void) {
    CategoryRow({ icon: icon, label: label, onRowClick: action }) {
      Image($r('app.media.reader_chevron_right')).width(14).height(14);
    }
  }

  // 开关行: CategoryRow + 尾部 ReaderToggle。
  @Builder
  private switchRow(label: string, icon: Resource, key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog',
  ) {
    CategoryRow({
      icon: icon,
      label: label,
      // The shared row already owns the topmost tap gesture. Wire the same
      // idempotent target value here so both the row and the visual toggle are
      // reachable on device and through accessibility focus.
      onRowClick: (): void => this.toggleSetting(key, !this.settingValue(key)),
    }) {
      ReaderToggle({
        value: this.settingValue(key),
        radius: 999,
        onToggle: (): void => this.toggleSetting(key, !this.settingValue(key)),
      });
    }
  }

  private onSnapshotChanged(): void {
    this.syncSnapshotValues();
  }

  private syncSnapshotValues(): void {
    this.autoCheckUpdateValue = this.snapshot.autoCheckUpdate;
    this.tapBottomScrollTopValue = this.snapshot.tapBottomScrollTop;
    this.reduceMotionValue = this.snapshot.reduceMotion;
    this.crashLogValue = this.snapshot.crashLog;
  }

  private toggleSetting(
    key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog',
    value: boolean,
  ): void {
    if (key === 'autoCheckUpdate') {
      this.autoCheckUpdateValue = value;
    } else if (key === 'tapBottomScrollTop') {
      this.tapBottomScrollTopValue = value;
    } else if (key === 'reduceMotion') {
      this.reduceMotionValue = value;
    } else {
      this.crashLogValue = value;
    }
    this.onToggle(key, value);
  }

  private settingValue(key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog'): boolean {
    if (key === 'autoCheckUpdate') {
      return this.autoCheckUpdateValue;
    }
    if (key === 'tapBottomScrollTop') {
      return this.tapBottomScrollTopValue;
    }
    if (key === 'reduceMotion') {
      return this.reduceMotionValue;
    }
    return this.crashLogValue;
  }

  // 下拉行: 页私有。通用 CategoryRow 把 trailing 垂直居中, 无法表达"label 固定居中 +
  // 下拉向下展开"。故用左(label 固定 57 居中) + 右(ReaderSelect 顶部 + 居中偏移)两列,
  // 使触发盒始终与 label 中线对齐。展开面板由 buildOverlay 在 SettingsShell 根 Stack
  // (全高 overlay 宿主) 内定位渲染 → 面板所有选项可点, 行固定高 → 页面不拉伸。
  @Builder
  private selectRow(label: string, icon: Resource, key: string, options: string[]) {
    Row({ space: 12 }) {
      this.labelColumn(label, icon);

      ReaderSelect({
        value: this.currentValue(key),
        options: options,
        isOpen: this.openSelect === key,
        variant: this.isTablet ? 'settingsTablet' : 'settingsPhone',
        reduceMotion: this.reduceMotionValue,
        onToggle: (): void => {
          this.openSelect = this.openSelect === key ? '' : key;
          const a = this.selectAnchors[key];
          if (a !== undefined) {
            this.anchorX = a.x;
            this.anchorY = a.y;
          }
        },
      })
        .margin({ top: SELECT_TRIGGER_OFFSET })
        .onAreaChange((_oldValue: Area, newValue: Area): void => {
          // Area.globalPosition 已是 vp 单位, 直接取用 (曾 px2vp 二次÷3.5 致面板错位)。
          this.selectAnchors[key] = {
            x: Number(newValue.globalPosition.x),
            y: Number(newValue.globalPosition.y),
          };
        });
    }
    .width('100%')
    .height(SELECT_ROW_H)
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
    .alignItems(VerticalAlign.Top)
    .border({ width: { top: TOK_BORDER_W }, color: TOK_ROW_DIVIDER });
  }

  // 分段控件行 (App主题): labelColumn + ReaderSegmentedControl, 垂直居中。
  @Builder
  private segmentRow(label: string, icon: Resource) {
    Row({ space: 12 }) {
      this.labelColumn(label, icon);

      ReaderSegmentedControl({
        options: SEG_OPTIONS,
        selectedIndex: this.themeIndex(),
        onSelect: (index: number): void => {
          this.themeValue = SEG_OPTIONS[index];
        },
      });
    }
    .width('100%')
    .constraintSize({ minHeight: SELECT_ROW_H })
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: TOK_BORDER_W }, color: TOK_ROW_DIVIDER });
  }

  // 行内左列: icon 盒 + label, 间距统一 12 (与 CategoryRow 同构)。
  @Builder
  private labelColumn(label: string, icon: Resource) {
    Row({ space: 12 }) {
      this.iconBox(icon);
      Text(label)
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(800)
        .fontSize(13)
        .lineHeight(15.34)
        .fontColor(TOK_INK)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .layoutWeight(1)
    .height(SELECT_ROW_H)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private cacheActionRow() {
    CategoryRow({
      icon: $r('app.media.settings_gen_cache'),
      label: '缓存清理',
      onRowClick: (): void => this.clearTextCache(),
    }) {
      // Keep the reactive state read in the concrete component tree. ArkUI
      // does not invalidate this slot when the value crosses a @Builder
      // argument boundary.
      Stack({ alignContent: Alignment.Center }) {
        Text(this.cacheActionLabel)
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(11)
          .fontColor(TOK_GREEN);
      }
      .width(66)
      .height(34)
      .borderRadius(6)
      .backgroundColor(TOK_SETTING_ACTION_BG);
    }
  }

  private clearTextCache(): void {
    if (this.cacheCleanupInFlight) {
      return;
    }
    this.cacheCleanupInFlight = true;
    this.cacheActionLabel = '清理中';
    void this.onClearCache()
      .then((cleared: boolean): void => {
        this.cacheActionLabel = cleared ? '已清理' : '清理失败';
      })
      .catch((): void => {
        this.cacheActionLabel = '清理失败';
      })
      .finally((): void => {
        this.cacheCleanupInFlight = false;
      });
  }

  @Builder
  private permissionRow(label: string, icon: Resource, badgeBg: string, badgeDot: string) {
    CategoryRow({ icon: icon, label: label }) {
      // Figma Article trailing 是 fit-content 聚簇 (状态徽标 + 去设置 + chevron), 6 间距。
      Row({ space: 6 }) {
        this.statusBadge(badgeBg, badgeDot);
        this.inlineAction('去设置', 55);
        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.reader_chevron_right')).width(14).height(14);
        }
        .width(16)
        .height(16);
      }
      .alignItems(VerticalAlign.Center);
    }
  }

  @Builder
  private iconBox(icon: Resource) {
    Stack({ alignContent: Alignment.Center }) {
      Image(icon).width(15).height(15);
    }
    .width(28)
    .height(28)
    .borderRadius(14)
    .backgroundColor(TOK_SETTING_ICON_BG);
  }

  private themeIndex(): number {
    const i = SEG_OPTIONS.indexOf(this.themeValue);
    return i >= 0 ? i : 0;
  }

  private currentValue(key: string): string {
    if (key === 'language') {
      return this.languageValue;
    } else if (key === 'startup') {
      return this.startupValue;
    }
    return this.animationValue;
  }

  private setSelectValue(key: string, value: string): void {
    if (key === 'language') {
      this.languageValue = value;
    } else if (key === 'startup') {
      this.startupValue = value;
    } else if (key === 'animation') {
      this.animationValue = value;
    }
  }

  private selectOptions(key: string): string[] {
    if (key === 'language') {
      return ['简体中文', '繁体中文', 'English', '日本語', '한국어'];
    } else if (key === 'startup') {
      return ['书架', '发现', 'RSS', '设置'];
    }
    return ['标准', '减弱', '关闭'];
  }

  // 展开面板: SettingsShell 根 Stack 即全高 overlay 宿主, 面板相对位置 = 触发条全局坐标
  // - 宿主原点。面板落在宿主 bounds 内 → 所有选项可点。
  @Builder
  private buildOverlay() {
    if (this.openSelect !== '') {
      ReaderSelectPanel({
        value: this.currentValue(this.openSelect),
        options: this.selectOptions(this.openSelect),
        x: this.anchorX - this.originX,
        y: this.anchorY - this.originY,
        variant: this.isTablet ? 'settingsTablet' : 'settingsPhone',
        reduceMotion: this.reduceMotionValue,
        onSelect: (opt: string): void => {
          this.setSelectValue(this.openSelect, opt);
          this.openSelect = '';
        },
      });
    }
  }

  @Builder
  private inlineAction(label: string, width: number) {
    Stack({ alignContent: Alignment.Center }) {
      Text(label)
        .fontFamily('ReaderInter')
        .fontWeight(800)
        .fontSize(11)
        .fontColor(TOK_GREEN);
    }
    .width(width)
    .height(34)
    .borderRadius(6)
    .backgroundColor(TOK_SETTING_ACTION_BG);
  }

  @Builder
  private statusBadge(bg: string, dot: string) {
    StatusBadge({ bg: bg, dot: dot, radius: 999 });
  }

  // 危险行是独立卡片(白底红字 chevron), 不属分类区块, 保留页私有。
  @Builder
  private dangerRow() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.settings_gen_refresh')).width(15).height(15);
      }
      .width(28)
      .height(28)
      .borderRadius(14)
      .backgroundColor(TOK_SETTING_ICON_BG);

      Text('恢复默认')
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(16)
        .lineHeight(19.2)
        .fontColor(TOK_DANGER)
        .maxLines(1);

      Image($r('app.media.reader_chevron_right')).width(14).height(14);
    }
    .width('100%')
    .constraintSize({ minHeight: 58 })
    .padding({ left: 13, right: TOK_SPACE_SM })
    .alignItems(VerticalAlign.Center)
    .backgroundColor('#E0FFFFFF')
    .borderRadius(8);
  }

}
