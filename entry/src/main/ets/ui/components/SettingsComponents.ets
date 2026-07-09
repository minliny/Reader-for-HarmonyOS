// SettingsComponents — settings skeleton ported from render-runtime.js
// mainTabSettings() DOM: single .fd-setting-section (h2 "设置" + N× .fd-setting-row
// nav rows: icon + title + chevron).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { InteractionDebugAdapter } from '../adapters/InteractionDebugAdapter';

interface SettingsRowSpec {
  title: string;
  chip: string;
  switchOn: boolean;
  chevron: boolean;
}

interface SettingsChoiceSpec {
  label: string;
  active: boolean;
}

function settingsRowSpec(itemId: string): SettingsRowSpec {
  switch (itemId) {
    case 'entry-reading': return { title: '阅读设置入口', chip: '', switchOn: false, chevron: true };
    case 'entry-source': return { title: '书源设置入口', chip: '', switchOn: false, chevron: true };
    case 'entry-sync': return { title: '同步设置入口', chip: '', switchOn: false, chevron: true };
    case 'entry-webdav': return { title: 'WebDAV 设置入口', chip: '', switchOn: false, chevron: true };
    case 'entry-backup': return { title: '备份恢复入口', chip: '', switchOn: false, chevron: true };
    case 'entry-about': return { title: '关于版本', chip: '', switchOn: false, chevron: true };
    case 'action-detail': return { title: '详情', chip: '', switchOn: false, chevron: true };
    case 'action-move-group': return { title: '移动分组', chip: '', switchOn: false, chevron: true };
    case 'action-cache': return { title: '下载 / 缓存', chip: '', switchOn: false, chevron: true };
    case 'action-rescan': return { title: '重新扫描', chip: '', switchOn: false, chevron: true };
    case 'action-remove': return { title: '移出书架', chip: '', switchOn: false, chevron: true };
    case 'group-default': return { title: '默认分组', chip: '12 本', switchOn: false, chevron: false };
    case 'group-scifi': return { title: '科幻', chip: '4 本', switchOn: false, chevron: false };
    case 'group-todo': return { title: '待读', chip: '7 本', switchOn: false, chevron: false };
    case 'auto-backup': return { title: '自动备份', chip: '', switchOn: true, chevron: false };
    case 'webdav-backup': return { title: '备份到 WebDAV', chip: '已开启', switchOn: false, chevron: false };
    case 'sub-1': return { title: '订阅源 1', chip: '', switchOn: true, chevron: false };
    case 'sub-2': return { title: '订阅源 2', chip: '', switchOn: true, chevron: false };
    case 'sub-3': return { title: '订阅源 3', chip: '', switchOn: true, chevron: false };
    case 'sub-4': return { title: '订阅源 4', chip: '', switchOn: true, chevron: false };
    default: return { title: '设置项', chip: '', switchOn: false, chevron: true };
  }
}

// .fd-setting-row (nav): grid icon-box 30 / 1fr / trailing-icon, min-height 48,
//   padding 0 14, border-top. icon-box 30 circle primary-tint. strong 13/800.
//   trailing chevron (fd-small-icon 20).
@Component
export struct SettingsNavRow {
  @Prop label: string = '';
  @Prop subtitle: string = '';
  @Prop icon: Resource | undefined = undefined;
  @Prop active: boolean = false;
  @Prop route: RouteId = 'settings-general';

  build() {
    Row({ space: 12 }) {
      if (this.icon !== undefined) {
        Stack({ alignContent: Alignment.Center }) {
          Image(this.icon).width(15).height(15)
        }
        .width(28)
        .height(28)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
      }
      Column() {
        Text(this.label)
          .fontSize(13)
          .fontWeight(800)
          .fontColor(ColorTokens.controlInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.subtitle !== '') {
          Text(this.subtitle)
            .fontSize(10)
            .fontColor(ColorTokens.muted)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .margin({ top: 2 })
        }
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      Image($r('app.media.ui_icon_chevron_dark')).width(18).height(18).opacity(0.5)
    }
    .width('100%')
    .height(58)
    .padding({ left: 12, right: 12 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
    .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: this.route }))
  }
}

// .fd-setting-section: h2 "设置" 13/900 + nav rows (5: 通用/书架搜索/书源/同步/关于).
@Component
export struct SettingsHomeSection {
  private rows: Array<[string, RouteId]> = [
    ['通用设置', 'settings-general'],
    ['书架与搜索设置', 'bookshelf-search-settings'],
    ['书源管理', 'source-management'],
    ['同步与备份', 'sync-backup'],
    ['关于与反馈', 'about-feedback'],
  ];

  build() {
    Column() {
      Text('设置')
        .fontSize(13)
        .fontWeight(900)
        .fontColor(ColorTokens.ink)
        .width('100%')
        .margin({ left: 12, top: 9, bottom: 5 })
      ForEach(this.rows, (r: [string, string], i: number) => {
        SettingsNavRow({ label: r[0], route: r[1] as RouteId })
      }, (r: [string, string], i: number) => `${r[0]}-${i}`)
      SettingsDeveloperRow()
    }
    .width('100%')
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
    .alignItems(HorizontalAlign.Start)
  }
}

// 开发者选项：开关写入 AppStorage 的 reader.devInteractionVisible，
// 控制 InteractionDebugFrame / InteractionDebugBadge 的显隐。
@Component
struct SettingsDeveloperRow {
  @StorageProp(InteractionDebugAdapter.K_VISIBLE) devVisible: boolean =
    InteractionDebugAdapter.DEFAULT_VISIBLE;

  build() {
    Row({ space: 12 }) {
      Stack({ alignContent: Alignment.Center }) {
        Text('D')
          .fontSize(13)
          .fontWeight(900)
          .fontColor(ColorTokens.primaryDark)
      }
      .width(28)
      .height(28)
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(ColorTokens.metaBg)

      Column() {
        Text('开发者选项')
          .fontSize(13)
          .fontWeight(800)
          .fontColor(ColorTokens.controlInk)
          .maxLines(1)
        Text('显示各模块边框等调试信息')
          .fontSize(10)
          .fontColor(ColorTokens.muted)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 2 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      Toggle({ type: ToggleType.Switch, isOn: this.devVisible })
        .selectedColor(ColorTokens.primary)
        .onChange((on: boolean) => {
          AppStorage.setOrCreate(InteractionDebugAdapter.K_VISIBLE, on);
        })
    }
    .width('100%')
    .height(58)
    .padding({ left: 12, right: 12 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
export struct SettingsHomePage {
  build() {
    SettingsHomeSection()
  }
}

@Component
struct SettingsStatusBadge {
  @Prop label: string = '';
  @Prop tone: string = 'good';

  build() {
    if (this.label.length > 0) {
      Text(this.label)
        .fontSize(11)
        .fontWeight(800)
        .fontColor(this.tone === 'warn' ? ColorTokens.accent : ColorTokens.primaryDark)
        .height(24)
        .padding({ left: 9, right: 9 })
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
        .border({ width: 1, color: this.tone === 'warn' ? ColorTokens.accent : ColorTokens.border })
    }
  }
}

@Component
struct SettingsMiniSwitch {
  @Prop on: boolean = true;

  build() {
    Row() {
      if (this.on) {
        Blank().layoutWeight(1)
      }
      Row()
        .width(18)
        .height(18)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(DemoAliasTokens.surface)
        .shadow({ radius: 3, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 1 })
      if (!this.on) {
        Blank().layoutWeight(1)
      }
    }
    .width(38)
    .height(22)
    .padding(2)
    .borderRadius(DemoAliasTokens.radiusPill)
    .backgroundColor(this.on ? ColorTokens.primary : ColorTokens.metaBg)
  }
}

@Component
struct SettingsSegment {
  @Prop options: SettingsChoiceSpec[] = [];

  build() {
    Row({ space: 4 }) {
      ForEach(this.options, (option: SettingsChoiceSpec, idx: number) => {
        Text(option.label)
          .fontSize(10)
          .fontWeight(800)
          .fontColor(option.active ? ColorTokens.primary : ColorTokens.muted)
          .height(24)
          .padding({ left: 9, right: 9 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(option.active ? Color.White : Color.Transparent)
      }, (option: SettingsChoiceSpec, idx: number) => `${option.label}-${idx}`)
    }
    .padding(3)
    .borderRadius(DemoAliasTokens.radiusPill)
    .backgroundColor(ColorTokens.metaBg)
  }
}

@Component
struct SettingsStepper {
  @Prop value: string = '3列';

  build() {
    Row({ space: 8 }) {
      Text('-')
        .fontSize(14)
        .fontWeight(900)
        .fontColor(ColorTokens.primaryDark)
      Text(this.value)
        .fontSize(12)
        .fontWeight(900)
        .fontColor(ColorTokens.ink)
      Text('+')
        .fontSize(14)
        .fontWeight(900)
        .fontColor(ColorTokens.primaryDark)
    }
    .height(28)
    .padding({ left: 10, right: 10 })
    .borderRadius(DemoAliasTokens.radiusPill)
    .backgroundColor(ColorTokens.metaBg)
    .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
struct SettingsOptionRow {
  @Prop title: string = '';
  @Prop subtitle: string = '';
  @Prop value: string = '';
  @Prop kind: string = 'value';
  @Prop switchOn: boolean = true;
  @Prop tone: string = 'good';
  @Prop options: SettingsChoiceSpec[] = [];

  build() {
    Row() {
      Stack()
        .width(30)
        .height(30)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
      Column() {
        Text(this.title)
          .fontSize(13)
          .fontWeight(850)
          .fontColor(ColorTokens.ink)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.subtitle.length > 0) {
          Text(this.subtitle)
            .fontSize(11)
            .fontColor(ColorTokens.muted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .margin({ top: 3 })
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      .margin({ left: 10, right: 10 })

      if (this.kind === 'segment') {
        SettingsSegment({ options: this.options })
      } else if (this.kind === 'stepper') {
        SettingsStepper({ value: this.value })
      } else if (this.kind === 'switch') {
        SettingsMiniSwitch({ on: this.switchOn })
      } else if (this.kind === 'status') {
        SettingsStatusBadge({ label: this.value, tone: this.tone })
      } else if (this.kind === 'action') {
        Text(this.value)
          .fontSize(12)
          .fontWeight(850)
          .fontColor(DemoAliasTokens.onPrimary)
          .height(30)
          .padding({ left: 12, right: 12 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.primary)
      } else {
        Text(this.value)
          .fontSize(12)
          .fontWeight(800)
          .fontColor(ColorTokens.primaryDark)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Image($r('app.media.ui_icon_chevron_dark'))
          .width(18)
          .height(18)
          .margin({ left: 4 })
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 58 })
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(DemoAliasTokens.surface)
  }
}

@Component
struct SettingsDetailSection {
  @Prop title: string = '设置';
  @BuilderParam content: () => void;

  build() {
    Column() {
      Text(this.title)
        .fontSize(13)
        .fontWeight(900)
        .fontColor(ColorTokens.ink)
        .width('100%')
        .margin({ left: 12, top: 9, bottom: 5 })
      this.content()
    }
    .width('100%')
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SettingsGeneralPage {
  build() {
    Column() {
      SettingsDetailSection({ title: '基础偏好' }) {
        SettingsOptionRow({
          title: 'App主题',
          kind: 'segment',
          options: [{ label: '跟随系统', active: true }, { label: '浅色', active: false }, { label: '深色', active: false }],
        })
        SettingsOptionRow({ title: '语言', value: '简体中文' })
        SettingsOptionRow({ title: '启动时打开', value: '书架' })
      }

      Column() {
        SettingsDetailSection({ title: '行为与反馈' }) {
          SettingsOptionRow({ title: '自动检查更新', kind: 'switch', switchOn: true })
          SettingsOptionRow({ title: '点击当前底栏回顶部', kind: 'switch', switchOn: true })
          SettingsOptionRow({ title: '减少动态效果', kind: 'switch', switchOn: true })
          SettingsOptionRow({ title: '崩溃日志', kind: 'status', value: '已开启' })
          SettingsOptionRow({ title: '动画效果', value: '标准' })
          SettingsOptionRow({ title: '缓存清理', kind: 'action', value: '清理缓存' })
        }
      }
      .width('100%')
      .margin({ top: 12 })

      Column() {
        SettingsDetailSection({ title: '系统权限' }) {
          SettingsOptionRow({ title: '文件访问', kind: 'status', value: '已授权' })
          SettingsOptionRow({ title: '通知权限', kind: 'status', value: '未授权', tone: 'warn' })
          SettingsOptionRow({ title: '电池优化', kind: 'status', value: '受系统管理' })
        }
      }
      .width('100%')
      .margin({ top: 12 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct BookshelfSearchSettingsPage {
  build() {
    Column() {
      SettingsDetailSection({ title: '书架' }) {
        SettingsOptionRow({
          title: '默认展示',
          kind: 'segment',
          options: [{ label: '封面', active: true }, { label: '列表', active: false }],
        })
        SettingsOptionRow({ title: '封面列数', kind: 'stepper', value: '3列' })
        SettingsOptionRow({ title: '默认分组', value: '全部' })
        SettingsOptionRow({ title: '显示更新标记', kind: 'switch', switchOn: true })
      }

      Column() {
        SettingsDetailSection({ title: '排序与筛选' }) {
          SettingsOptionRow({ title: '书架排序', value: '最近更新' })
          SettingsOptionRow({ title: '展示范围', value: '全部' })
          SettingsOptionRow({ title: '更新状态', value: '不限' })
        }
      }
      .width('100%')
      .margin({ top: 12 })

      Column() {
        SettingsDetailSection({ title: '搜索' }) {
          SettingsOptionRow({ title: '搜索范围', value: '全局' })
          SettingsOptionRow({ title: '结果排序', value: '相关度' })
          SettingsOptionRow({ title: '合并同名同作者', kind: 'switch', switchOn: true })
          SettingsOptionRow({ title: '搜索历史', kind: 'switch', switchOn: true })
          SettingsOptionRow({ title: '搜索历史数量', value: '20条' })
        }
      }
      .width('100%')
      .margin({ top: 12 })

      Column() {
        SettingsDetailSection({ title: '搜索操作' }) {
          SettingsOptionRow({ title: '清空搜索历史', kind: 'action', value: '清空' })
        }
      }
      .width('100%')
      .margin({ top: 12 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct ProgressSyncPage {
  build() {
    Column() {
      SettingsDetailSection({ title: '阅读进度同步' }) {
        SettingsOptionRow({ title: '当前书籍', kind: 'status', value: '已同步' })
        SettingsOptionRow({ title: '同步范围', value: '书架与阅读进度' })
        SettingsOptionRow({ title: '同步频率', value: '阅读后自动同步' })
        SettingsOptionRow({ title: '冲突处理', value: '保留较新进度' })
      }
      Column() {
        SettingsDetailSection({ title: '同步状态' }) {
          SettingsOptionRow({ title: '深空信号', subtitle: '25% · 刚刚同步', kind: 'status', value: '已同步' })
          SettingsOptionRow({ title: '三体', subtitle: '第 34 章 · 5 分钟前', kind: 'status', value: '已同步' })
          SettingsOptionRow({ title: '基地', subtitle: '第 1 章 · 待上传', kind: 'status', value: '待同步', tone: 'warn' })
        }
      }
      .width('100%')
      .margin({ top: 12 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SettingsSection {
  @Prop title: string = '';

  build() {
    Blank()
      .width('100%')
      .height(0)
  }
}

@Component
export struct SettingsListItem {
  @Prop itemId: string = '';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  build() {
    Row() {
      Text(settingsRowSpec(this.itemId).title)
        .fontSize(14)
        .fontWeight(600)
        .fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      if (settingsRowSpec(this.itemId).switchOn) {
        Toggle({ type: ToggleType.Switch, isOn: true })
          .selectedColor(ColorTokens.primary)
          .onChange((on: boolean) => ReaderUiStore.dispatch({ type: 'toggle-reduced-motion', enabled: on }))
      } else if (settingsRowSpec(this.itemId).chip.length > 0) {
        Text(settingsRowSpec(this.itemId).chip)
          .fontSize(12)
          .fontWeight(600)
          .fontColor(ColorTokens.primary)
          .height(24)
          .padding({ left: 10, right: 10 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .border({ width: 1, color: ColorTokens.primary })
          .backgroundColor(ColorTokens.paper)
      } else if (settingsRowSpec(this.itemId).chevron) {
        Text('›')
          .fontSize(20)
          .fontColor(ColorTokens.controlInk)
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 48 })
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(14)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(ColorTokens.floatingControlBg)
  }
}
