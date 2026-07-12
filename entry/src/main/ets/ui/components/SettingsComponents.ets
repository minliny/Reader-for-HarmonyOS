// SettingsComponents — settings skeleton ported from render-runtime.js
// mainTabSettings() DOM: single .fd-setting-section (h2 "设置" + N× .fd-setting-row
// nav rows: icon + title + chevron).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { InteractionDebugAdapter } from '../adapters/InteractionDebugAdapter';
import { MotionAdapter } from '../adapters/MotionAdapter';
import { TokenAdapter } from '../adapters/TokenAdapter';
import { BookshelfView, CoreBookGroup } from '../store/ReaderUiState';

interface SettingsRowSpec {
  title: string;
  chip: string;
  switchOn: boolean;
  chevron: boolean;
}

interface SettingsChoiceSpec {
  label: string;
  value: string;   // B1 P0：segment 选项对应的设置值
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
    // These legacy list ids still occur in compatibility view states.  Neither
    // has a background scheduler or an enabled-state projection, so do not
    // render a live-looking switch / "已开启" badge.
    case 'auto-backup': return { title: '自动备份', chip: '未接入', switchOn: false, chevron: false };
    case 'webdav-backup': return { title: '备份到 WebDAV', chip: '手动执行', switchOn: false, chevron: false };
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
  // B1 P0：路由跳转用 MotionAdapter.apply 包裹，motionId 取 SettingsShell 的 app.route.push.forward
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

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
    .onClick(() => {
        // 设置项跳转：route-push 到子页，用 SettingsShell 的 push 动效包裹
        MotionAdapter.apply('app.route.push.forward', this.reducedMotion, this.getUIContext(), () => {
          ReaderUiStore.dispatch({ type: 'route-push', id: this.route });
        });
      })
  }
}

// .fd-setting-section: h2 "设置" 13/900 + nav rows (5: 通用/书架搜索/书源/同步/关于).
@Component
export struct SettingsHomeSection {
  private rows: Array<[string, RouteId, string]> = [
    ['通用设置', 'settings-general', 'gear'],
    ['书架与搜索设置', 'bookshelf-search-settings', 'bookshelf'],
    ['书源管理', 'source-management', 'source-stack'],
    ['同步与备份', 'sync-backup', 'sync'],
    ['关于与反馈', 'about-feedback', 'info'],
  ];

  build() {
    Column() {
      Text('设置')
        .fontSize(13)
        .fontWeight(900)
        .fontColor(ColorTokens.ink)
        .width('100%')
        .margin({ left: 12, top: 9, bottom: 5 })
      ForEach(this.rows, (r: [string, string, string], i: number) => {
        SettingsNavRow({ label: r[0], route: r[1] as RouteId, icon: TokenAdapter.icon(r[2]) })
      }, (r: [string, string, string], i: number) => `${r[0]}-${i}`)
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
        Image(TokenAdapter.icon('motion')).width(15).height(15)
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
  @Prop settingsKey: string = '';   // B1 P0：开关对应的设置项 key

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
    .onClick(() => {
      // B1 P0：开关切换，按 settingsKey 派发对应 reducer 事件
      const next = !this.on;
      if (this.settingsKey === 'reducedMotion') {
        ReaderUiStore.dispatch({ type: 'toggle-reduced-motion', enabled: next });
      } else {
        ReaderUiStore.dispatch({ type: 'settings-switch-toggle', settingsKey: this.settingsKey, settingsToggleValue: next });
      }
    })
  }
}

@Component
struct SettingsSegment {
  @Prop options: SettingsChoiceSpec[] = [];
  @Prop settingsKey: string = '';   // B1 P0：segment 对应的设置项 key
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

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
          .onClick(() => {
            MotionAdapter.apply('segment.item.switch', this.reducedMotion, this.getUIContext(), () => {
              // B1 P0：segment 切换。bookshelfView 走专用 reducer，其余走 settings-segment-switch
              if (this.settingsKey === 'bookshelfView') {
                ReaderUiStore.dispatch({ type: 'set-bookshelf-view', bookshelfView: option.value as BookshelfView });
              } else {
                ReaderUiStore.dispatch({ type: 'settings-segment-switch', settingsKey: this.settingsKey, settingsValue: option.value });
              }
            });
          })
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
  @Prop settingsKey: string = '';   // B1 P0：stepper 对应的设置项 key

  build() {
    Row({ space: 8 }) {
      Text('-')
        .fontSize(14)
        .fontWeight(900)
        .fontColor(ColorTokens.primaryDark)
        .onClick(() => {
          // B1 P0：stepper 减少，delta = -1
          ReaderUiStore.dispatch({ type: 'settings-stepper-change', settingsKey: this.settingsKey, delta: -1 });
        })
      Text(this.value)
        .fontSize(12)
        .fontWeight(900)
        .fontColor(ColorTokens.ink)
      Text('+')
        .fontSize(14)
        .fontWeight(900)
        .fontColor(ColorTokens.primaryDark)
        .onClick(() => {
          // B1 P0：stepper 增加，delta = +1
          ReaderUiStore.dispatch({ type: 'settings-stepper-change', settingsKey: this.settingsKey, delta: 1 });
        })
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
  @Prop settingsKey: string = '';   // B1 P0：设置项 key，透传给 segment/stepper/switch
  @Prop icon: Resource | undefined = undefined;   // P1.1：行首图标，通过 TokenAdapter.icon() 传入
  @StorageProp('reader.pendingCacheClear') pendingCacheClear: boolean = false;

  build() {
    Row() {
      Stack({ alignContent: Alignment.Center }) {
        if (this.icon !== undefined) {
          Image(this.icon).width(15).height(15)
        }
      }
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
        SettingsSegment({ options: this.options, settingsKey: this.settingsKey })
      } else if (this.kind === 'stepper') {
        SettingsStepper({ value: this.value, settingsKey: this.settingsKey })
      } else if (this.kind === 'switch') {
        SettingsMiniSwitch({ on: this.switchOn, settingsKey: this.settingsKey })
      } else if (this.kind === 'status') {
        SettingsStatusBadge({ label: this.value, tone: this.tone })
      } else if (this.kind === 'action') {
        Text(this.settingsKey === 'cache-clear' && this.pendingCacheClear ? '确认清理' : this.value)
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
    .onClick(() => {
      // P1.2：select/action 控件接 onClick
      if (this.kind === 'value') {
        ReaderUiStore.dispatch({ type: 'settings-select-open', settingsKey: this.settingsKey });
      } else if (this.kind === 'action') {
        if (this.settingsKey === 'cache-clear' && this.pendingCacheClear) {
          ReaderUiStore.dispatch({ type: 'cache-clear-confirm' });
        } else {
          ReaderUiStore.dispatch({ type: 'settings-action', settingsKey: this.settingsKey });
        }
      }
    })
  }
}

// P1.2：select 选项面板（条件渲染的 Column）。当 expandedOptionKey 等于某 settingsKey 时显示。
// 选中选项后派发 settings-segment-switch（segment 类）或 settings-select-close（纯关闭）。
@Component
struct SettingsSelectSheet {
  @Prop options: SettingsChoiceSpec[] = [];
  @Prop settingsKey: string = '';

  private select(value: string): void {
    // These two settings already have Core-backed bookshelf reducers/effects.
    // Do not route them through the generic segment reducer, which would make
    // the sheet look selected while leaving the Core query unchanged.
    if (this.settingsKey === 'bookshelfSort') {
      ReaderUiStore.dispatch({ type: 'set-bookshelf-sort', bookshelfSort: value });
    } else if (this.settingsKey === 'bookshelfGroup') {
      ReaderUiStore.dispatch({ type: 'set-bookshelf-group', bookshelfGroup: value });
    } else {
      ReaderUiStore.dispatch({ type: 'settings-segment-switch', settingsKey: this.settingsKey, settingsValue: value });
    }
    ReaderUiStore.dispatch({ type: 'settings-select-close' });
  }

  build() {
    Column() {
      ForEach(this.options, (option: SettingsChoiceSpec, idx: number) => {
        Row() {
          Text(option.label)
            .fontSize(13)
            .fontWeight(option.active ? 800 : 400)
            .fontColor(option.active ? ColorTokens.primary : ColorTokens.ink)
            .layoutWeight(1)
          if (option.active) {
            Image(TokenAdapter.icon('checkmark')).width(16).height(16)
          }
        }
        .width('100%')
        .height(44)
        .padding({ left: 12, right: 12 })
        .border({ width: { top: idx === 0 ? 0 : 1 }, color: ColorTokens.border })
        .alignItems(VerticalAlign.Center)
        .onClick(() => this.select(option.value))
      }, (option: SettingsChoiceSpec, idx: number) => `${option.label}-${idx}`)
    }
    .width('100%')
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .margin({ top: 4, bottom: 4 })
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
  // B1 P0：从 AppStorage 读取设置状态，驱动 segment/switch 动态渲染
  @StorageProp('reader.appThemeMode') appThemeMode: string = 'system';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp('reader.pendingCacheClear') pendingCacheClear: boolean = false;

  build() {
    Column() {
      SettingsDetailSection({ title: '基础偏好' }) {
        SettingsOptionRow({
          title: 'App主题',
          kind: 'segment',
          settingsKey: 'appThemeMode',
          icon: TokenAdapter.icon('palette'),
          options: [
            { label: '跟随系统', value: 'system', active: this.appThemeMode === 'system' },
            { label: '浅色', value: 'light', active: this.appThemeMode === 'light' },
            { label: '深色', value: 'dark', active: this.appThemeMode === 'dark' },
          ],
        })
        SettingsOptionRow({
          title: '语言',
          subtitle: '当前没有本地化消费方或可持久化设置契约',
          kind: 'status',
          value: '未接入',
          tone: 'warn',
          icon: TokenAdapter.icon('globe'),
        })
        SettingsOptionRow({
          title: '启动时打开',
          subtitle: '当前没有启动路由持久化与消费方',
          kind: 'status',
          value: '未接入',
          tone: 'warn',
          icon: TokenAdapter.icon('home'),
        })
      }

      Column() {
        SettingsDetailSection({ title: '行为与反馈' }) {
          SettingsOptionRow({
            title: '自动检查更新',
            subtitle: '当前没有更新检查 Host 服务或设置消费方',
            kind: 'status',
            value: '未接入',
            tone: 'warn',
            icon: TokenAdapter.icon('refresh'),
          })
          SettingsOptionRow({
            title: '点击当前底栏回顶部',
            subtitle: '当前底栏未消费该行为设置',
            kind: 'status',
            value: '未接入',
            tone: 'warn',
            icon: TokenAdapter.icon('top'),
          })
          SettingsOptionRow({ title: '减少动态效果', kind: 'switch', settingsKey: 'reducedMotion', switchOn: this.reducedMotion, icon: TokenAdapter.icon('motion') })
          SettingsOptionRow({
            title: '崩溃日志',
            subtitle: '当前未接入日志开关或状态查询',
            kind: 'status',
            value: '状态未接入',
            tone: 'warn',
            icon: TokenAdapter.icon('bug'),
          })
          SettingsOptionRow({
            title: '动画效果',
            subtitle: '转场由当前 Motion 方案控制，尚无独立选择器消费方',
            kind: 'status',
            value: '未接入',
            tone: 'warn',
            icon: TokenAdapter.icon('play'),
          })
          SettingsOptionRow({
            title: '缓存清理',
            subtitle: '仅清理本会话网络缓存；不会删除 Core 阅读正文、书架或备份',
            kind: 'action',
            value: '清理本会话缓存',
            settingsKey: 'cache-clear',
            icon: TokenAdapter.icon('trash'),
          })
          if (this.pendingCacheClear) {
            Row({ space: 8 }) {
              Text('取消')
                .fontSize(12)
                .fontWeight(750)
                .fontColor(ColorTokens.primary)
                .height(32)
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .borderRadius(DemoAliasTokens.radiusPill)
                .border({ width: 1, color: ColorTokens.border })
                .onClick(() => ReaderUiStore.dispatch({ type: 'cache-clear-cancel' }))
              Text('确认仅清理会话缓存')
                .fontSize(12)
                .fontWeight(750)
                .fontColor(DemoAliasTokens.onPrimary)
                .height(32)
                .layoutWeight(1)
                .textAlign(TextAlign.Center)
                .borderRadius(DemoAliasTokens.radiusPill)
                .backgroundColor(ColorTokens.primary)
                .onClick(() => ReaderUiStore.dispatch({ type: 'cache-clear-confirm' }))
            }
            .width('100%')
            .padding({ left: 12, right: 12, top: 8, bottom: 4 })
          }
        }
      }
      .width('100%')
      .margin({ top: 12 })

      Column() {
        SettingsDetailSection({ title: '系统权限' }) {
          SettingsOptionRow({
            title: '文件访问',
            subtitle: '仅在导入时由系统文档选择器按需授予；当前不查询固定授权状态',
            kind: 'status',
            value: '按需选取',
            icon: TokenAdapter.icon('folder'),
          })
          SettingsOptionRow({
            title: '通知权限',
            subtitle: '当前未接入通知权限查询或申请',
            kind: 'status',
            value: '状态未接入',
            tone: 'warn',
            icon: TokenAdapter.icon('bell'),
          })
          SettingsOptionRow({
            title: '电池优化',
            subtitle: '当前未接入系统电池优化状态查询',
            kind: 'status',
            value: '状态未接入',
            tone: 'warn',
            icon: TokenAdapter.icon('battery'),
          })
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
  // All values below are either consumed by the real Core-backed bookshelf /
  // history effects, or are rendered explicitly unavailable. No row may
  // advertise a setting merely because the demo had a chevron.
  @StorageProp('reader.bookshelfFilter.view') bookshelfView: string = 'cover';
  @StorageProp('reader.bookshelfFilter.group') bookshelfGroup: string = 'all';
  @StorageProp('reader.bookshelfFilter.sort') bookshelfSort: string = 'recent';
  @StorageProp('reader.bookGroups') bookGroups: CoreBookGroup[] = [];
  @StorageProp('reader.coverColumns') coverColumns: number = 3;
  @StorageProp('reader.settingsToggles.mergeSameBooks') mergeSameBooks: boolean = true;
  @StorageProp('reader.settingsToggles.enableSearchHistory') enableSearchHistory: boolean = true;
  @StorageProp('reader.searchHistoryLimit') searchHistoryLimit: number = 20;
  @StorageProp('reader.expandedOptionKey') expandedOptionKey: string = '';

  private groupOptions(): SettingsChoiceSpec[] {
    const options: SettingsChoiceSpec[] = [{ label: '全部', value: 'all', active: this.bookshelfGroup === 'all' }];
    for (let index = 0; index < this.bookGroups.length; index++) {
      const group = this.bookGroups[index];
      if (group.groupName.trim().length === 0) continue;
      options.push({
        label: group.groupName,
        value: group.groupName,
        active: this.bookshelfGroup === group.groupName,
      });
    }
    return options;
  }

  private groupLabel(): string {
    if (this.bookshelfGroup === 'all') return '全部';
    for (let index = 0; index < this.bookGroups.length; index++) {
      if (this.bookGroups[index].groupName === this.bookshelfGroup) return this.bookshelfGroup;
    }
    return '分组已不存在';
  }

  private sortOptions(): SettingsChoiceSpec[] {
    return [
      { label: '最近阅读', value: 'recent', active: this.bookshelfSort === 'recent' },
      { label: '书名', value: 'title', active: this.bookshelfSort === 'title' },
      { label: '作者', value: 'author', active: this.bookshelfSort === 'author' },
    ];
  }

  private sortLabel(): string {
    switch (this.bookshelfSort) {
      // A legacy stored `progress` value predates Core's actual sort DTO.
      // It is normalized to the only truthful reading-time sort.
      case 'progress': return '最近阅读';
      case 'title': return '书名';
      case 'author': return '作者';
      default: return '最近阅读';
    }
  }

  build() {
    Column() {
      SettingsDetailSection({ title: '书架' }) {
        SettingsOptionRow({
          title: '默认展示',
          kind: 'segment',
          settingsKey: 'bookshelfView',
          icon: TokenAdapter.icon('grid'),
          options: [
            { label: '封面', value: 'cover', active: this.bookshelfView === 'cover' },
            { label: '列表', value: 'list', active: this.bookshelfView === 'list' },
          ],
        })
        SettingsOptionRow({ title: '封面列数', kind: 'stepper', settingsKey: 'coverColumns', value: `${this.coverColumns}列`, icon: TokenAdapter.icon('columns') })
        SettingsOptionRow({ title: '书架分组', value: this.groupLabel(), settingsKey: 'bookshelfGroup', icon: TokenAdapter.icon('folder') })
        if (this.expandedOptionKey === 'bookshelfGroup') {
          SettingsSelectSheet({ settingsKey: 'bookshelfGroup', options: this.groupOptions() })
        }
        SettingsOptionRow({
          title: '显示更新标记',
          subtitle: 'Core bookshelf.list 尚未提供可比较的更新状态',
          kind: 'status', value: '未接入', tone: 'warn', icon: TokenAdapter.icon('badge'),
        })
      }

      Column() {
        SettingsDetailSection({ title: '排序与筛选' }) {
          SettingsOptionRow({ title: '书架排序', value: this.sortLabel(), settingsKey: 'bookshelfSort', icon: TokenAdapter.icon('sort') })
          if (this.expandedOptionKey === 'bookshelfSort') {
            SettingsSelectSheet({
              settingsKey: 'bookshelfSort',
              options: this.sortOptions(),
            })
          }
          SettingsOptionRow({
            title: '展示范围', subtitle: 'Core 未提供阅读状态筛选 DTO',
            kind: 'status', value: '全部', tone: 'warn', icon: TokenAdapter.icon('list'),
          })
          SettingsOptionRow({
            title: '更新状态', subtitle: 'Core 未提供更新状态筛选 DTO',
            kind: 'status', value: '未接入', tone: 'warn', icon: TokenAdapter.icon('refresh'),
          })
        }
      }
      .width('100%')
      .margin({ top: 12 })

      Column() {
        SettingsDetailSection({ title: '搜索' }) {
          SettingsOptionRow({
            title: '搜索范围', subtitle: 'Core 当前搜索所有已启用书源',
            kind: 'status', value: '全部书源', icon: TokenAdapter.icon('search'),
          })
          SettingsOptionRow({
            title: '结果排序', subtitle: 'Core 未提供可验证的结果排序 DTO',
            kind: 'status', value: '书源顺序', tone: 'warn', icon: TokenAdapter.icon('sort'),
          })
          SettingsOptionRow({
            title: '合并同名同作者', subtitle: '仅合并展示；打开详情仍保留首条 Core 书源身份',
            kind: 'switch', settingsKey: 'mergeSameBooks', switchOn: this.mergeSameBooks, icon: TokenAdapter.icon('people'),
          })
          SettingsOptionRow({
            title: '搜索历史', subtitle: '仅控制新关键词是否写入 Core',
            kind: 'switch', settingsKey: 'enableSearchHistory', switchOn: this.enableSearchHistory, icon: TokenAdapter.icon('clock'),
          })
          SettingsOptionRow({ title: '搜索历史数量', value: `${this.searchHistoryLimit}条`, settingsKey: 'searchHistoryLimit', icon: TokenAdapter.icon('list') })
          if (this.expandedOptionKey === 'searchHistoryLimit') {
            SettingsSelectSheet({
              settingsKey: 'searchHistoryLimit',
              options: [
                { label: '10条', value: '10', active: this.searchHistoryLimit === 10 },
                { label: '20条', value: '20', active: this.searchHistoryLimit === 20 },
                { label: '50条', value: '50', active: this.searchHistoryLimit === 50 },
              ],
            })
          }
        }
      }
      .width('100%')
      .margin({ top: 12 })

      Column() {
        SettingsDetailSection({ title: '搜索操作' }) {
          SettingsOptionRow({ title: '清空搜索历史', kind: 'action', value: '清空', settingsKey: 'clear-search-history', icon: TokenAdapter.icon('trash') })
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
      Text('跨设备进度同步未接入')
        .fontSize(18)
        .fontWeight(800)
        .fontColor(ColorTokens.controlInk)
      Text('阅读进度会写入本机 Core 存储，并可通过同步页的完整 Core 快照手动备份和恢复。当前没有远端进度队列、自动同步频率或按书冲突处理契约，因此不显示“已同步”“待上传”或固定书名。')
        .fontSize(13)
        .fontColor(ColorTokens.muted)
        .lineHeight(20)
        .margin({ top: 10 })
      Text('打开 Core 数据备份')
        .fontSize(13)
        .fontWeight(800)
        .fontColor(DemoAliasTokens.onPrimary)
        .height(40)
        .width('100%')
        .textAlign(TextAlign.Center)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.primary)
        .margin({ top: 16 })
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'sync-backup' }))
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
