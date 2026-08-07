// Settings General — rebuilt 2026-08-05 against live Figma nodes
// 943:2897 (Phone 390×844) / 943:3369 (Tablet 760×960).
// Structural notes: sections are rounded white cards (#E6FFFCF8 + 1px #C1C7CD);
// rows are 58 tall with a top divider; row controls are right-aligned with a
// 14vp inset from the card inner edge (matches Figma switch right edge 336/706).
import { MainTabBar } from '../shell/MainTabBar';
import { registerReaderFonts } from '../common/ReaderFonts';
import { PageBackBar } from '../common/PageBackBar';
import { ReaderToggle } from '../common/ReaderToggle';
import { ReaderSelect } from '../common/ReaderSelect';
import { ReaderCard } from '../common/ReaderCard';
import { ReaderSectionHeading } from '../common/ReaderSectionHeading';
import { StatusBadge } from '../common/StatusBadge';
import {
  TOK_BORDER,
  TOK_CARD_BG,
  TOK_CONTENT_MAX_W_PHONE,
  TOK_CONTENT_MAX_W_TABLET,
  TOK_DANGER,
  TOK_FIELD_SURFACE,
  TOK_GREEN,
  TOK_INK,
  TOK_PAPER,
  TOK_ROW_DIVIDER,
  TOK_SCREEN_INSET,
  TOK_SPACE_CARD_PADDING,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';

// 页面私有布局常量 (不属共享 token: 页面独有间距/图标底色/特殊宽度, 见 §四)。
const PHONE_DANGER_WIDTH = 350.903;
const TABLET_DANGER_WIDTH = 720;
const ICON_BG = '#172379A4';       // rgba(35,121,164,0.09)
const ACTION_BG = '#1A2379A4';     // rgba(35,121,164,0.10)
const CONTROL_INSET = 14;

export interface SettingsSnapshot {
  autoCheckUpdate: boolean;
  tapBottomScrollTop: boolean;
  reduceMotion: boolean;
  crashLog: boolean;
}

@Component
export struct SettingsPage {
  @State private activeSection: 'home' | 'general' = 'home';

  @Prop snapshot: SettingsSnapshot = {
    autoCheckUpdate: true,
    tapBottomScrollTop: true,
    reduceMotion: false,
    crashLog: true,
  };
  @Prop isTablet: boolean;
  @State private themeValue: string = '跟随系统';
  @State private languageValue: string = '简体中文';
  @State private startupValue: string = '书架';
  @State private animationValue: string = '标准';
  @State private openSelect: string = '';
  onBack: () => void = (): void => {};
  onOpenSourceManagement: () => void = (): void => {};
  onOpenSync: () => void = (): void => {};
  onRssRequested: () => void = (): void => {};
  onDiscoverRequested: () => void = (): void => {};
  onToggle: (key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog', value: boolean) => void =
    (_key: string, _value: boolean): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column() {
      if (this.activeSection === 'home') {
        this.homeTopBar();
      } else {
        this.generalBackBar();
      }
      if (this.activeSection === 'home') {
        this.settingsHome();
        MainTabBar({ current: 'settings', onSelect: (key: string): void => this.onMainTab(key) });
      } else {
        Scroll() {
          Column({ space: TOK_SPACE_SM }) {
            this.preferenceCard();
            this.behaviorCard();
            this.permissionCard();
            this.dangerRow();
          }
          .width('100%')
          .padding({ left: TOK_SCREEN_INSET, right: TOK_SCREEN_INSET, top: TOK_SPACE_XS, bottom: TOK_SPACE_SM });
        }
        .layoutWeight(1)
        .width('100%')
        .scrollBar(BarState.Off);
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(TOK_PAPER);
  }

  @Builder
  private generalBackBar() {
    PageBackBar({
      title: '通用设置',
      onBack: (): void => {
        this.activeSection = 'home';
      },
    });
  }

  @Builder
  private homeTopBar() {
    Row() {
      Text('设置')
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(29)
        .lineHeight(38)
        .fontColor(TOK_INK);
    }
    .width('100%')
    .height(58)
    .padding({ left: 20, right: 20, top: 6 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private settingsHome() {
    Scroll() {
      Column({ space: TOK_SPACE_SM }) {
        ReaderCard({ bg: TOK_CARD_BG, cardBorder: TOK_BORDER, radius: 8, cardWidth: this.contentWidth() }) {
          Column() {
            ReaderSectionHeading({ title: '设置' });
            Column() {
              this.homeRow('通用设置', $r('app.media.settings_row_general'), (): void => {
                this.activeSection = 'general';
              });
              this.homeRow('书架与搜索设置', $r('app.media.settings_row_shelf_search'), (): void => {});
              this.homeRow('书源管理', $r('app.media.settings_row_source'), (): void => this.onOpenSourceManagement());
              this.homeRow('同步与备份', $r('app.media.settings_row_sync'), (): void => this.onOpenSync());
              this.homeRow('关于与反馈', $r('app.media.settings_row_about'), (): void => {});
            }
            .width('100%')
            .margin({ top: 5 });
          }
          .width('100%')
          .padding({ top: TOK_SPACE_CONTROL_INLINE, bottom: 1 });
        }
      }
      .width('100%')
      .padding({ left: TOK_SCREEN_INSET, right: TOK_SCREEN_INSET, top: TOK_SPACE_XS, bottom: TOK_SPACE_SM });
    }
    .layoutWeight(1)
    .width('100%')
    .align(Alignment.Top)
    .scrollBar(BarState.Off);
  }

  @Builder
  private homeRow(label: string, icon: Resource, action: () => void) {
    Row() {
      this.iconBox(icon);
      Text(label)
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(800)
        .fontSize(13)
        .lineHeight(15.34)
        .fontColor(TOK_INK)
        .maxLines(1);
      Image($r('app.media.rss_chevron')).width(16).height(14);
    }
    .width('100%')
    .height(58)
    .padding({ left: TOK_SPACE_SM, right: CONTROL_INSET })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: 0.5 }, color: TOK_ROW_DIVIDER })
    .onClick((): void => action());
  }

  private onMainTab(key: string): void {
    if (key === 'bookshelf') {
      this.onBack();
    } else if (key === 'discover') {
      this.onDiscoverRequested();
    } else if (key === 'rss') {
      this.onRssRequested();
    }
    // 'settings' is this page; MainTabBar suppresses the current tab.
  }

  @Builder
  private preferenceCard() {
    ReaderCard({ bg: TOK_CARD_BG, cardBorder: TOK_BORDER, radius: 8, cardWidth: this.contentWidth() }) {
      Column() {
        ReaderSectionHeading({ title: '基础偏好' });
        Column() {
          this.selectRow('App主题', $r('app.media.settings_gen_theme'), 'theme', ['跟随系统', '浅色', '深色']);
          this.selectRow('语言', $r('app.media.settings_gen_language'), 'language',
            ['简体中文', '繁体中文', 'English', '日本語', '한국어']);
          this.selectRow('启动时打开', $r('app.media.settings_gen_startup'), 'startup',
            ['书架', '发现', 'RSS', '设置']);
        }
        .width('100%')
        .margin({ top: 5 });
      }
      .width('100%')
      .padding({ top: TOK_SPACE_CONTROL_INLINE, bottom: 1 });
    }
  }

  @Builder
  private behaviorCard() {
    ReaderCard({ bg: TOK_CARD_BG, cardBorder: TOK_BORDER, radius: 8, cardWidth: this.contentWidth() }) {
      Column() {
        ReaderSectionHeading({ title: '行为与反馈' });
        Column() {
          this.switchRow('自动检查更新', $r('app.media.settings_gen_update'), 'autoCheckUpdate', this.snapshot.autoCheckUpdate);
          this.switchRow('点击当前底栏回顶部', $r('app.media.settings_gen_tap_top'), 'tapBottomScrollTop', this.snapshot.tapBottomScrollTop);
          this.switchRow('减少动态效果', $r('app.media.settings_gen_motion'), 'reduceMotion', this.snapshot.reduceMotion);
          this.switchRow('崩溃日志', $r('app.media.settings_gen_crash'), 'crashLog', this.snapshot.crashLog);
          this.selectRow('动画效果', $r('app.media.settings_gen_animation'), 'animation', ['标准', '减弱', '关闭']);
          this.actionRow('缓存清理', $r('app.media.settings_gen_cache'), '清理缓存');
        }
        .width('100%')
        .margin({ top: 5 });
      }
      .width('100%')
      .padding({ top: TOK_SPACE_CONTROL_INLINE, bottom: 1 });
    }
  }

  @Builder
  private permissionCard() {
    ReaderCard({ bg: TOK_CARD_BG, cardBorder: TOK_BORDER, radius: 8, cardWidth: this.contentWidth() }) {
      Column() {
        ReaderSectionHeading({ title: '系统权限' });
        Column() {
          this.permissionRow('文件访问', $r('app.media.settings_gen_file'), '#212B895C', '#28704E');
          this.permissionRow('通知权限', $r('app.media.settings_gen_notification'), '#24B0661D', '#8C521D');
          this.permissionRow('电池优化', $r('app.media.settings_gen_battery'), '#212379A4', TOK_GREEN);
        }
        .width('100%')
        .margin({ top: 5 });
      }
      .width('100%')
      .padding({ top: TOK_SPACE_CONTROL_INLINE, bottom: 1 });
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
    .backgroundColor(ICON_BG);
  }

  @Builder
  private switchRow(label: string, icon: Resource, key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog',
    value: boolean) {
    Row() {
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
      this.settingsSwitch(value, (): void => this.onToggle(key, !value));
    }
    .width('100%')
    .height(58)
    .padding({ left: TOK_SPACE_SM, right: CONTROL_INSET })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: 0.5 }, color: TOK_ROW_DIVIDER });
  }

  @Builder
  private selectRow(label: string, icon: Resource, key: string, options: string[]) {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
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
      .width('100%')
      .height(58)
      .padding({ left: TOK_SPACE_SM, right: CONTROL_INSET })
      .alignItems(VerticalAlign.Center)
      .border({ width: { top: 0.5 }, color: TOK_ROW_DIVIDER });

      // 下拉统一 (问题 2): 复用共享 ReaderSelect, 消除 SettingsPage.selectSurface 双实现。
      ReaderSelect({
        value: this.currentValue(key),
        options: options,
        isOpen: this.openSelect === key,
        onToggle: (): void => {
          this.openSelect = this.openSelect === key ? '' : key;
        },
        onSelect: (opt: string): void => {
          this.setSelectValue(key, opt);
          this.openSelect = '';
        },
      })
        .position({ x: this.contentWidth() - CONTROL_INSET - this.selectWidth(options), y: 11 });
    }
    .width('100%')
    .height(this.surfaceStackHeight(key, options));
  }

  // 统一下拉已收敛到共享 ReaderSelect(动效 1506:8807); 此处不再有私有复制。
  private selectWidth(options: string[]): number {
    let maxLen = 0;
    for (const opt of options) {
      if (opt.length > maxLen) {
        maxLen = opt.length;
      }
    }
    return maxLen * 12 + 44;
  }

  private surfaceStackHeight(key: string, options: string[]): number {
    if (this.openSelect === key) {
      return 11 + options.length * 36;
    }
    return 58;
  }

  @Builder
  private actionRow(label: string, icon: Resource, actionLabel: string) {
    Row() {
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
      this.inlineAction(actionLabel, 66);
    }
    .width('100%')
    .height(58)
    .padding({ left: TOK_SPACE_SM, right: CONTROL_INSET })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: 0.5 }, color: TOK_ROW_DIVIDER });
  }

  @Builder
  private permissionRow(label: string, icon: Resource, badgeBg: string, badgeDot: string) {
    Row() {
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
      Row() {
        this.statusBadge(badgeBg, badgeDot);
        Row().width(55);
        this.inlineAction('去设置', 55);
        Row().width(6);
        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.rss_chevron')).width(14).height(14);
        }
        .width(16)
        .height(16);
      }
      .alignItems(VerticalAlign.Center);
    }
    .width('100%')
    .height(58)
    .padding({ left: TOK_SPACE_SM, right: CONTROL_INSET })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: 0.5 }, color: TOK_ROW_DIVIDER });
  }

  @Builder
  private settingsSwitch(value: boolean, onTap: () => void) {
    ReaderToggle({ value: value, radius: 12, onToggle: onTap });
  }

  private currentValue(key: string): string {
    if (key === 'theme') {
      return this.themeValue;
    } else if (key === 'language') {
      return this.languageValue;
    } else if (key === 'startup') {
      return this.startupValue;
    }
    return this.animationValue;
  }

  private setSelectValue(key: string, value: string): void {
    if (key === 'theme') {
      this.themeValue = value;
    } else if (key === 'language') {
      this.languageValue = value;
    } else if (key === 'startup') {
      this.startupValue = value;
    } else if (key === 'animation') {
      this.animationValue = value;
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
    .backgroundColor(ACTION_BG);
  }

  @Builder
  private statusBadge(bg: string, dot: string) {
    StatusBadge({ bg: bg, dot: dot, radius: 9 });
  }

  @Builder
  private dangerRow() {
    Row() {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.settings_gen_refresh')).width(15).height(15);
      }
      .width(28)
      .height(28)
      .borderRadius(14)
      .backgroundColor(ICON_BG);

      Text('恢复默认')
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(16)
        .lineHeight(19.2)
        .fontColor(TOK_DANGER)
        .maxLines(1)
        .margin({ left: TOK_SPACE_CONTROL_INLINE });

      Image($r('app.media.rss_chevron')).width(14).height(14);
    }
    .width(this.isTablet ? TABLET_DANGER_WIDTH : PHONE_DANGER_WIDTH)
    .height(58)
    .padding({ left: 12.55, right: TOK_SPACE_CARD_PADDING })
    .alignItems(VerticalAlign.Center)
    .backgroundColor('#E0FFFFFF')
    .borderRadius(8);
  }

  private contentWidth(): number {
    return this.isTablet ? TOK_CONTENT_MAX_W_TABLET : TOK_CONTENT_MAX_W_PHONE;
  }
}
