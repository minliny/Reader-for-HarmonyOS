// Settings General — rebuilt 2026-08-05 against live Figma nodes
// 943:2897 (Phone 390×844) / 943:3369 (Tablet 760×960).
// Batch 3: 设置/偏好/行为/权限四个区块收敛到 CategorySection(Card+Heading+rows)，
// 行收敛到 CategoryRow(icon盒+label+trailing)。仅 selectRow 与 dangerRow 保留为
// 页私有 —— 下拉展开会撑高行(见下), 通用 CategoryRow 无法表达; 危险行是独立卡片。
import { SettingsShell } from '../shell/SettingsShell';
import { registerReaderFonts } from '../common/ReaderFonts';
import { ReaderToggle } from '../common/ReaderToggle';
import { ReaderSelect } from '../common/ReaderSelect';
import { StatusBadge } from '../common/StatusBadge';
import { CategorySection } from './CategorySection';
import { CategoryRow } from './CategoryRow';
import {
  TOK_CONTENT_MAX_W_TABLET,
  TOK_DANGER,
  TOK_GREEN,
  TOK_INK,
  TOK_ROW_DIVIDER,
  TOK_SETTING_ACTION_BG,
  TOK_SETTING_ICON_BG,
  TOK_SPACE_CARD_PADDING,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_SM,
} from '../common/ReaderTokens';

// 页面私有布局常量 (不属共享 token: 页面独有下拉行对齐常量)。
const CONTROL_INSET = 14;
// selectRow 专用: 下拉(ReaderSelect 36 高触发)在 57 行内垂直居中, 展开时下拉撑高行。
// 偏移 = (57-36)/2, 派生自布局常量, 非页面坐标。
const SELECT_ROW_H = 57;
const SELECT_TRIGGER_H = 36;
const SELECT_TRIGGER_OFFSET = (SELECT_ROW_H - SELECT_TRIGGER_H) / 2;

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
      homeContent: this.buildHome,
      generalContent: this.buildGeneral,
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
      this.selectRow('App主题', $r('app.media.settings_gen_theme'), 'theme', ['跟随系统', '浅色', '深色']);
      this.selectRow('语言', $r('app.media.settings_gen_language'), 'language',
        ['简体中文', '繁体中文', 'English', '日本語', '한국어']);
      this.selectRow('启动时打开', $r('app.media.settings_gen_startup'), 'startup',
        ['书架', '发现', 'RSS', '设置']);
    }
  }

  @Builder
  private behaviorCard() {
    CategorySection({ title: '行为与反馈' }) {
      this.switchRow('自动检查更新', $r('app.media.settings_gen_update'), 'autoCheckUpdate', this.snapshot.autoCheckUpdate);
      this.switchRow('点击当前底栏回顶部', $r('app.media.settings_gen_tap_top'), 'tapBottomScrollTop', this.snapshot.tapBottomScrollTop);
      this.switchRow('减少动态效果', $r('app.media.settings_gen_motion'), 'reduceMotion', this.snapshot.reduceMotion);
      this.switchRow('崩溃日志', $r('app.media.settings_gen_crash'), 'crashLog', this.snapshot.crashLog);
      this.selectRow('动画效果', $r('app.media.settings_gen_animation'), 'animation', ['标准', '减弱', '关闭']);
      this.actionRow('缓存清理', $r('app.media.settings_gen_cache'), '清理缓存');
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
      Image($r('app.media.rss_chevron')).width(16).height(14);
    }
  }

  // 开关行: CategoryRow + 尾部 ReaderToggle。
  @Builder
  private switchRow(label: string, icon: Resource, key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog',
    value: boolean) {
    CategoryRow({ icon: icon, label: label }) {
      ReaderToggle({ value: value, radius: 12, onToggle: (): void => this.onToggle(key, !value) });
    }
  }

  // 下拉行: 页私有。下拉展开会撑高行(向下推后续行), 通用 CategoryRow 把 trailing 垂直
  // 居中, 无法表达"label 固定居中 + 下拉向下展开"。故用左(label 固定 57 居中) +
  // 右(ReaderSelect 顶部 + 居中偏移)两列, 使触发盒始终与 label 中线对齐。
  @Builder
  private selectRow(label: string, icon: Resource, key: string, options: string[]) {
    Row({ space: 12 }) {
      Column() {
        Row() {
          this.iconBox(icon);
          Text(label)
            .layoutWeight(1)
            .fontFamily('ReaderInter')
            .fontWeight(900)
            .fontSize(13)
            .lineHeight(15.6)
            .fontColor(TOK_INK)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        .width('100%')
        .height(SELECT_ROW_H)
        .alignItems(VerticalAlign.Center);
      }
      .layoutWeight(1);

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
        .margin({ top: SELECT_TRIGGER_OFFSET });
    }
    .width('100%')
    .constraintSize({ minHeight: SELECT_ROW_H })
    .padding({ left: TOK_SPACE_SM, right: CONTROL_INSET })
    .alignItems(VerticalAlign.Top)
    .border({ width: { top: 1 }, color: TOK_ROW_DIVIDER });
  }

  @Builder
  private actionRow(label: string, icon: Resource, actionLabel: string) {
    CategoryRow({ icon: icon, label: label }) {
      this.inlineAction(actionLabel, 66);
    }
  }

  @Builder
  private permissionRow(label: string, icon: Resource, badgeBg: string, badgeDot: string) {
    CategoryRow({ icon: icon, label: label }) {
      // Figma Article trailing 是 fit-content 聚簇 (状态徽标 + 去设置 + chevron), 6 间距。
      Row({ space: 6 }) {
        this.statusBadge(badgeBg, badgeDot);
        this.inlineAction('去设置', 55);
        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.rss_chevron')).width(14).height(14);
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
    .backgroundColor(TOK_SETTING_ACTION_BG);
  }

  @Builder
  private statusBadge(bg: string, dot: string) {
    StatusBadge({ bg: bg, dot: dot, radius: 9 });
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

      Image($r('app.media.rss_chevron')).width(14).height(14);
    }
    .width('100%')
    .constraintSize({ minHeight: 57, maxWidth: TOK_CONTENT_MAX_W_TABLET })
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_CARD_PADDING })
    .alignItems(VerticalAlign.Center)
    .backgroundColor('#E0FFFFFF')
    .borderRadius(8);
  }

}