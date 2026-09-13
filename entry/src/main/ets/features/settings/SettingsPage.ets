import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderThemeHost } from '../../app/ReaderThemeHost';
// Settings General — rebuilt 2026-08-05 against live Figma nodes
// 943:2897 (Phone 390×844) / 943:3369 (Tablet 760×960).
// Batch 3: 设置/偏好/行为/权限四个区块收敛到 CategorySection(Card+Heading+rows)，
// 行收敛到 CategoryRow(icon盒+label+trailing)。仅 selectRow 与 dangerRow 保留为
// 页私有 —— 下拉展开会撑高行(见下), 通用 CategoryRow 无法表达; 危险行是独立卡片。
import { SettingsShell } from '../shell/SettingsShell';
import { registerReaderFonts } from '../common/ReaderFonts';
import { ReaderToggle } from '../common/ReaderToggle';
import { ReaderSelect } from '../common/ReaderSelect';
import { ReaderSegmentedControl } from '../common/ReaderSegmentedControl';
import { StatusBadge } from '../common/StatusBadge';
import { CategorySection } from './CategorySection';
import { CategoryRow } from './CategoryRow';
import { SettingsSelectOverlay, type SettingsSelectField } from './SettingsSelectOverlay';
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
import { isReaderProductSurfaceEnabled } from '../../app/ReaderProductScope';

// 页面私有布局常量 (不属共享 token: 页面独有下拉行对齐常量)。
// Figma Article 行右内距 12 (= TOK_SPACE_SM, 直引)。
// selectRow 专用: Figma Settings/SelectTrigger (`4104:3585`) 为 34 高，
// 在 58 行内垂直居中。Phone 用右箭头，Tablet 用下/上箭头。
const SELECT_ROW_H = 58;
const SELECT_TRIGGER_H = 34;
const SELECT_TRIGGER_OFFSET = (SELECT_ROW_H - SELECT_TRIGGER_H) / 2;
// App主题 为分段控件 (Figma ThemeSegment 2114:20635), 非下拉; 标签用 Figma 原文。
const SEG_OPTIONS: string[] = ['跟随', '浅色', '深色'];

interface SettingsSelectAnchor {
  right: number;
  bottom: number;
}

export interface SettingsSnapshot {
  autoCheckUpdate: boolean;
  tapBottomScrollTop: boolean;
  reduceMotion: boolean;
  crashLog: boolean;
}

@Component
export struct SettingsPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @State private activeSection: 'home' | 'general' = 'home';

  @Prop @Watch('onSnapshotChanged') snapshot: SettingsSnapshot = {
    autoCheckUpdate: true,
    tapBottomScrollTop: true,
    reduceMotion: false,
    crashLog: true,
  };
  @Prop isTablet: boolean;
  @StorageLink('readerAppThemeMode') private appThemeMode: string = 'system';
  @State private languageValue: string = '简体中文';
  @State private startupValue: string = '书架';
  @State private animationValue: string = '标准';
  @State private autoCheckUpdateValue: boolean = true;
  @State private tapBottomScrollTopValue: boolean = true;
  @State private reduceMotionValue: boolean = false;
  @State private crashLogValue: boolean = true;
  @State private cacheActionLabel: string = '清理文字缓存';
  @State private cacheCleanupInFlight: boolean = false;
  @State private resetInFlight: boolean = false;
  @State private resetMessage: string = '';
  private mounted: boolean = false;
  private resetRevision: number = 0;
  @State private openSelect: SettingsSelectField | '' = '';
  // 展开面板锚点: 触发条全局坐标减去宿主 Stack 原点, 得面板相对宿主 Stack 的位置。
  // selectAnchors 为普通 map(非 @State): 逐行 onAreaChange 写入, 打开时读入 anchorX/Y。
  @State private anchorRight: number = 0;
  @State private anchorBottom: number = 0;
  @State private originX: number = 0;
  @State private originY: number = 0;
  private selectAnchors: Record<string, SettingsSelectAnchor> = {};
  onBack: () => void = (): void => {};
  onOpenSourceManagement: () => void = (): void => {};
  onOpenBookshelfSettings: () => void = (): void => {};
  onOpenRulesManagement: () => void = (): void => {};
  onOpenSync: () => void = (): void => {};
  onRssRequested: () => void = (): void => {};
  onDiscoverRequested: () => void = (): void => {};
  onClearCache: () => Promise<boolean> = async (): Promise<boolean> => false;
  onRestoreDefaults: () => Promise<boolean> = async (): Promise<boolean> => false;
  onToggle: (key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog', value: boolean) => void =
    (_key: string, _value: boolean): void => {};

  aboutToAppear(): void {
    this.mounted = true;
    registerReaderFonts(this.getUIContext().getFont());
    this.syncSnapshotValues();
  }

  aboutToDisappear(): void { this.mounted = false; this.resetRevision += 1; }

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
    }).enabled(!this.resetInFlight);
  }

  @Builder
  private buildHome() {
    CategorySection({ title: '设置' }) {
      this.navRow('通用设置', (this.appThemeScheme === 'night' ? $r('app.media.settings_row_general_theme_night') : $r('app.media.settings_row_general')), (): void => {
        this.activeSection = 'general';
      });
      this.navRow('书源管理', (this.appThemeScheme === 'night' ? $r('app.media.settings_row_source_theme_night') : $r('app.media.settings_row_source')), (): void => this.onOpenSourceManagement());
      if (isReaderProductSurfaceEnabled('sync')) {
        this.navRow('同步与备份', (this.appThemeScheme === 'night' ? $r('app.media.settings_row_sync_theme_night') : $r('app.media.settings_row_sync')), (): void => this.onOpenSync());
      }
      this.navRow('书架设置', (this.appThemeScheme === 'night' ? $r('app.media.settings_row_shelf_search_theme_night') : $r('app.media.settings_row_shelf_search')), this.onOpenBookshelfSettings);
      if (isReaderProductSurfaceEnabled('unimplementedSettings')) {
        this.navRow('关于与反馈', (this.appThemeScheme === 'night' ? $r('app.media.settings_row_about_theme_night') : $r('app.media.settings_row_about')), (): void => {});
      }
    }
  }

  @Builder
  private buildGeneral() {
    this.preferenceCard();
    this.behaviorCard();
    if (isReaderProductSurfaceEnabled('unimplementedSettings')) {
      this.permissionCard();
    }
    this.dangerRow();
    if (this.resetMessage.length > 0) {
      Text(this.resetMessage).fontSize(12).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .width('100%').padding(12);
    }
  }

  @Builder
  private preferenceCard() {
    CategorySection({ title: '基础偏好' }) {
      this.segmentRow('App主题', (this.appThemeScheme === 'night' ? $r('app.media.settings_gen_theme_theme_night') : $r('app.media.settings_gen_theme')));
      if (isReaderProductSurfaceEnabled('unimplementedSettings')) {
      this.selectRow('语言', (this.appThemeScheme === 'night' ? $r('app.media.settings_gen_language_theme_night') : $r('app.media.settings_gen_language')), 'language',
        ['简体中文', '繁體中文', 'English', '日本語', '한국어']);
      this.selectRow('启动时打开', (this.appThemeScheme === 'night' ? $r('app.media.settings_gen_startup_theme_night') : $r('app.media.settings_gen_startup')), 'startup',
        ['书架', '发现', 'RSS', '设置']);
      }
    }
  }

  @Builder
  private behaviorCard() {
    CategorySection({ title: '行为与反馈' }) {
      this.switchRow('自动检查更新', (this.appThemeScheme === 'night' ? $r('app.media.settings_gen_update_theme_night') : $r('app.media.settings_gen_update')), 'autoCheckUpdate');
      this.switchRow('减少动态效果', (this.appThemeScheme === 'night' ? $r('app.media.settings_gen_motion_theme_night') : $r('app.media.settings_gen_motion')), 'reduceMotion');
      if (isReaderProductSurfaceEnabled('unimplementedSettings')) {
        this.switchRow('点击当前底栏回顶部', (this.appThemeScheme === 'night' ? $r('app.media.settings_gen_tap_top_theme_night') : $r('app.media.settings_gen_tap_top')), 'tapBottomScrollTop');
        this.switchRow('崩溃日志', (this.appThemeScheme === 'night' ? $r('app.media.settings_gen_crash_theme_night') : $r('app.media.settings_gen_crash')), 'crashLog');
        this.selectRow('动画效果', (this.appThemeScheme === 'night' ? $r('app.media.settings_gen_animation_theme_night') : $r('app.media.settings_gen_animation')), 'animation', ['标准', '减弱', '关闭']);
      }
      this.cacheActionRow();
    }
  }

  @Builder
  private permissionCard() {
    CategorySection({ title: '系统权限' }) {
      this.permissionRow('文件访问', (this.appThemeScheme === 'night' ? $r('app.media.settings_gen_file_theme_night') : $r('app.media.settings_gen_file')), readerAppColor('app.SettingsPage.permissionCard.permissionRow.212B895C', this.appThemeScheme), readerAppColor('app.SettingsPage.permissionCard.permissionRow.FF28704E', this.appThemeScheme));
      this.permissionRow('通知权限', (this.appThemeScheme === 'night' ? $r('app.media.settings_gen_notification_theme_night') : $r('app.media.settings_gen_notification')), readerAppColor('app.SettingsPage.permissionCard.permissionRow.24B0661D', this.appThemeScheme), readerAppColor('app.SettingsPage.permissionCard.permissionRow.FF8C521D', this.appThemeScheme));
      this.permissionRow('电池优化', (this.appThemeScheme === 'night' ? $r('app.media.settings_gen_battery_theme_night') : $r('app.media.settings_gen_battery')), readerAppColor('app.SettingsPage.permissionCard.permissionRow.212379A4', this.appThemeScheme), readerAppColor('TOK_GREEN', this.appThemeScheme));
    }
  }

  // 导航行: CategoryRow + 尾部 chevron。
  @Builder
  private navRow(label: string, icon: Resource, action: () => void) {
    CategoryRow({ icon: icon, label: label, onRowClick: action }) {
      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_right_theme_night') : $r('app.media.reader_chevron_right'))).width(14).height(14);
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
  private selectRow(label: string, icon: Resource, key: SettingsSelectField, options: string[]) {
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
            this.anchorRight = a.right;
            this.anchorBottom = a.bottom;
          }
        },
      })
        .margin({ top: SELECT_TRIGGER_OFFSET })
        .onAreaChange((_oldValue: Area, newValue: Area): void => {
          // Area.globalPosition 已是 vp 单位, 直接取用 (曾 px2vp 二次÷3.5 致面板错位)。
          this.selectAnchors[key] = {
            right: Number(newValue.globalPosition.x) + Number(newValue.width),
            bottom: Number(newValue.globalPosition.y) + Number(newValue.height),
          };
        });
    }
    .width('100%')
    .height(SELECT_ROW_H)
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
    .alignItems(VerticalAlign.Top)
    .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) });
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
          void ReaderThemeHost.selectApp(index === 0 ? 'system' : index === 1 ? 'day' : 'night')
            .catch((): void => { this.getUIContext().getPromptAction().showToast({ message: '主题保存失败，已恢复原配置' }); });
        },
      });
    }
    .width('100%')
    .constraintSize({ minHeight: SELECT_ROW_H })
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) });
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
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
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
      icon: (this.appThemeScheme === 'night' ? $r('app.media.settings_gen_cache_theme_night') : $r('app.media.settings_gen_cache')),
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
          .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme));
      }
      .width(66)
      .height(34)
      .borderRadius(6)
      .backgroundColor(readerAppColor('TOK_SETTING_ACTION_BG', this.appThemeScheme));
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
          Image((this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_right_theme_night') : $r('app.media.reader_chevron_right'))).width(14).height(14);
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
    .backgroundColor(readerAppColor('TOK_SETTING_ICON_BG', this.appThemeScheme));
  }

  private themeIndex(): number {
    const i = SEG_OPTIONS.indexOf((this.appThemeMode === 'system' ? SEG_OPTIONS[0] : this.appThemeMode === 'day' ? SEG_OPTIONS[1] : SEG_OPTIONS[2]));
    return i >= 0 ? i : 0;
  }

  private currentValue(key: SettingsSelectField): string {
    if (key === 'language') {
      return this.languageValue;
    } else if (key === 'startup') {
      return this.startupValue;
    }
    return this.animationValue;
  }

  private setSelectValue(key: SettingsSelectField, value: string): void {
    if (key === 'language') {
      this.languageValue = value;
    } else if (key === 'startup') {
      this.startupValue = value;
    } else if (key === 'animation') {
      this.animationValue = value;
    }
  }

  private selectOptions(key: SettingsSelectField): string[] {
    if (key === 'language') {
      return ['简体中文', '繁體中文', 'English', '日本語', '한국어'];
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
      SettingsSelectOverlay({
        isTablet: this.isTablet,
        field: this.openSelect,
        value: this.currentValue(this.openSelect),
        options: this.selectOptions(this.openSelect),
        anchorRight: this.anchorRight - this.originX,
        anchorBottom: this.anchorBottom - this.originY,
        onSelect: (opt: string): void => {
          const field = this.openSelect;
          if (field !== '') {
            this.setSelectValue(field, opt);
          }
          this.openSelect = '';
        },
        onDismiss: (): void => {
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
        .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme));
    }
    .width(width)
    .height(34)
    .borderRadius(6)
    .backgroundColor(readerAppColor('TOK_SETTING_ACTION_BG', this.appThemeScheme));
  }

  @Builder
  private statusBadge(bg: string, dot: string) {
    StatusBadge({ bg: bg, dot: dot, radius: 999 });
  }

  // 危险行是独立卡片(白底红字 chevron), 不属分类区块, 保留页私有。
  private requestRestoreDefaults(): void {
    if (this.resetInFlight) return;
    const revision = this.resetRevision;
    this.getUIContext().showAlertDialog({
      title: '恢复界面与阅读设置',
      message: '恢复通用偏好、书架封面模式、默认日夜阅读主题、跟随系统、阅读排版与朗读偏好。保留书籍、书源、进度、书签、导入字体文件及同步和朗读服务凭据。',
      primaryButton: { value: '取消', action: (): void => {} },
      secondaryButton: { value: '恢复默认', fontColor: readerAppColor('TOK_DANGER', this.appThemeScheme),
        action: (): void => { if (this.mounted && revision === this.resetRevision) void this.performRestoreDefaults(); } },
    });
  }

  private async performRestoreDefaults(): Promise<void> {
    if (this.resetInFlight) return;
    this.resetInFlight = true;
    const revision = ++this.resetRevision;
    this.resetMessage = '';
    try {
      const done = await this.onRestoreDefaults();
      if (!this.mounted || revision !== this.resetRevision) return;
      this.resetMessage = done ? '已恢复界面与阅读设置' : '恢复未完成，请重试';
    } catch (_) {
      if (this.mounted && revision === this.resetRevision) this.resetMessage = '恢复未完成，已保留恢复记录；点击恢复默认重试';
    } finally {
      if (this.mounted && revision === this.resetRevision) this.resetInFlight = false;
    }
  }

  @Builder
  private dangerRow() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      Stack({ alignContent: Alignment.Center }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.settings_gen_refresh_theme_night') : $r('app.media.settings_gen_refresh'))).width(15).height(15);
      }
      .width(28)
      .height(28)
      .borderRadius(14)
      .backgroundColor(readerAppColor('TOK_SETTING_ICON_BG', this.appThemeScheme));

      Text('恢复默认')
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(16)
        .lineHeight(19.2)
        .fontColor(readerAppColor('TOK_DANGER', this.appThemeScheme))
        .maxLines(1);

      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_right_theme_night') : $r('app.media.reader_chevron_right'))).width(14).height(14);
    }
    .width('100%')
    .constraintSize({ minHeight: 58 })
    .padding({ left: 13, right: TOK_SPACE_SM })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor('app.SettingsPage.dangerRow.backgroundColor.E0FFFFFF', this.appThemeScheme))
    .borderRadius(8)
    .onClick((): void => this.requestRestoreDefaults());
  }

}
