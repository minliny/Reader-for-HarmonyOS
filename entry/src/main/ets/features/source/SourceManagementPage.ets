// Source Management — rebuilt 2026-08-05 against live Figma nodes
// 943:4281 (Phone 390×844) / 943:4745 (Tablet 760×960).
// Structural notes: search field h38 r8 + status filter (5 chips h32 r16)
// + group filter (folder icon + select) above a 70-tall source list whose
// rows carry status badge + bordered 检测 button + 44×24 switch + login
// button (when the source declares loginUrl); bottom action bar = 批量管理
// + ＋新增书源. Content inset is 19vp.
import {
  type BookSource,
} from './SourceGateway';
import type { SourceManagementStatusKind } from './SourceOrchestrator';
import { readerSourceCategoryLabel, type ReaderSourceCategory } from './ReaderSourceCategory';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { registerReaderFonts } from '../common/ReaderFonts';
import { PageBackBar } from '../common/PageBackBar';
import { ReaderSearchField } from '../common/ReaderSearchField';
import { ReaderToggle } from '../common/ReaderToggle';
import { ReaderSelect } from '../common/ReaderSelect';
import { ReaderSelectPanel } from '../common/ReaderSelectPanel';
import { StatusBadge } from '../common/StatusBadge';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  readerVisualSafeLeft,
  readerVisualSafeRight,
} from '../common/ReaderWindowMetrics';
import {
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_CONTENT_MAX_W_TABLET,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_PRIMARY_DARK,
  TOK_ROW_DIVIDER,
  TOK_SCREEN_INSET,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SURFACE_SOLID,
} from '../common/ReaderTokens';

const GROUP_FILTER_WIDTH = 350;
const GROUP_SELECT_WIDTH = 276;
const SEARCH_FIELD_BORDER = '#75B4A697';  // shared search/action field outline
const CHIP_BORDER = '#85B4A697';   // rgba(180,166,151,0.52)
const STATUS_GOOD_BG = '#212B895C';   // rgba(43,137,92,0.13)
const STATUS_GOOD_DOT = '#28704E';
const STATUS_MUTED_BG = '#1F8C8276';  // rgba(140,130,118,0.12)
const STATUS_MUTED_DOT = '#8C8276';
const STATUS_ERROR_BG = '#21A8584D';
const STATUS_ERROR_DOT = '#A8584D';

class SourceListDataSource implements IDataSource {
  private items: BookSource[] = [];
  private listeners: DataChangeListener[] = [];

  totalCount(): number {
    return this.items.length;
  }

  getData(index: number): BookSource {
    return this.items[index];
  }

  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener);
    }
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  replace(items: BookSource[]): void {
    this.items = items;
    for (const listener of this.listeners) {
      listener.onDataReloaded();
    }
  }
}

@Component
export struct SourceManagementPage {
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onSourcesChanged') sources: BookSource[];
  // 额外分组可由调用方补充；常规选项直接来自 Core 返回的原始
  // bookSource.bookSourceGroup，不按启用状态等 UI 属性伪造。
  @Prop groups: string[] = [];
  @Prop isTablet: boolean;
  @Prop reduceMotion: boolean = false;
  @Prop statusKind: SourceManagementStatusKind = 'idle';
  @Prop statusMessage: string = '';
  onBack: () => void = (): void => {};
  onToggleSource: (id: string, enabled: boolean) => void = (_id: string, _enabled: boolean): void => {};
  onDetectSource: (id: string) => void = (_id: string): void => {};
  onLoginSource: (id: string) => void = (_id: string): void => {};
  onAddSource: () => void = (): void => {};
  onOpenTools: () => void = (): void => {};
  onRetryLoad: () => void = (): void => {};
  @State private searchQuery: string = '';
  @State private statusValue: string = '全部';
  @State private categoryValue: string = 'all';
  @State private groupValue: string = '全部分组';
  @State private groupOpen: boolean = false;
  @State private groupClosing: boolean = false;
  @State private projectedSources: BookSource[] = [];
  private readonly sourceDataSource: SourceListDataSource = new SourceListDataSource();
  // 展开面板锚点: 触发条全局坐标 - 根 Stack 原点 = 面板相对根 Stack 位置。
  @State private groupX: number = 0;
  @State private groupY: number = 0;
  @State private originX: number = 0;
  @State private originY: number = 0;
  @State private viewportWidth: number = 0;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.rebuildSourceProjection();
  }

  build() {
    // 根 Stack = 下拉面板 overlay 宿主: 展开面板必须挂在全高容器才可点 (ArkUI 命中测试
    // 裁到父边界, 固定高行内面板下层选项不可点)。
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        this.backBar();
        Column() {
          this.searchField();
          this.statsRow();
          if (this.statusKind !== 'idle') {
            this.statusBanner();
          }
          this.filterArea();
          this.categoryFilter();
          this.sourceList();
          this.bottomActionBar();
        }
        .layoutWeight(1)
        .width('100%')
        .padding({ left: this.contentFrame().left, right: this.contentFrame().right });
      }
      .width('100%')
      .height('100%')
      .backgroundColor(TOK_PAPER)
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        // Area.globalPosition 已是 vp 单位, 直接取用 (曾 px2vp 二次÷3.5 致面板错位)。
        this.originX = Number(newValue.globalPosition.x);
        this.originY = Number(newValue.globalPosition.y);
        const width = this.numericAreaLength(newValue.width);
        if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
          this.viewportWidth = width;
        }
      });

      if (this.groupOpen) {
        Row().width('100%').height('100%').backgroundColor(Color.Transparent)
          .onClick((): void => { this.groupClosing = true; });
        ReaderSelectPanel({
          value: this.groupValue,
          options: this.groupOptions(),
          variant: 'sourceGroup',
          controlWidth: this.groupSelectWidth(),
          reduceMotion: this.reduceMotion,
          closing: this.groupClosing,
          selectionId: 'source-group',
          x: this.groupX - this.originX,
          y: this.groupY - this.originY,
          onCommit: (opt: string, _identity: string): void => {
            this.groupValue = opt;
            this.rebuildSourceProjection();
          },
          onDismiss: (): void => {
            this.groupOpen = false;
            this.groupClosing = false;
          },
        });
      }
    }
    .width('100%')
    .height('100%')
    .clip(true);
  }

  @Builder
  private backBar() {
    PageBackBar({
      title: '书源管理',
      onBack: (): void => this.onBack(),
    }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_more')).width(20).height(20);
      }
      .width(44)
      .height(44)
      .borderRadius(22)
      .onClick((): void => this.onOpenTools());
    }
  }

  @Builder
  private searchField() {
    Row() {
      ReaderSearchField({
        variant: 'sourceManagement',
        mode: 'live',
        text: this.searchQuery,
        placeholder: '搜索书源名称或域名',
        accessibilityLabel: '搜索书源名称或域名',
        onTextChange: (value: string): void => {
          this.searchQuery = value;
          this.rebuildSourceProjection();
        },
        onSubmit: (): void => this.rebuildSourceProjection(),
      });
    }
    .width(this.contentFrame().width)
    .height(38)
    .alignItems(VerticalAlign.Center)
    .margin({ top: TOK_SPACE_XS });
  }

  @Builder
  private statsRow() {
    Text(this.statsText())
      .width(this.contentFrame().width)
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Regular)
      .fontSize(10)
      .lineHeight(12.5)
      .fontColor(TOK_MUTED)
      .maxLines(1)
      .margin({ top: TOK_SPACE_XS });
  }

  @Builder
  private statusBanner() {
    Row({ space: TOK_SPACE_XS }) {
      Text(this.statusMessage)
        .layoutWeight(1)
        .fontFamily('ReaderNotoSansSC')
        .fontSize(11)
        .lineHeight(16)
        .fontColor(this.statusKind === 'error' ? STATUS_ERROR_DOT : TOK_INK)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      if (this.statusKind === 'error') {
        Text('重试')
          .fontFamily('ReaderNotoSansSC')
          .fontSize(11)
          .fontWeight(FontWeight.Bold)
          .fontColor(TOK_PRIMARY_DARK)
          .onClick((): void => this.onRetryLoad());
      }
    }
    .width(this.contentFrame().width)
    .padding(TOK_SPACE_XS)
    .margin({ top: TOK_SPACE_XS })
    .backgroundColor(this.statusKind === 'error' ? STATUS_ERROR_BG : TOK_CARD_BG)
    .borderRadius(7);
  }

  @Builder
  private filterArea() {
    if (this.isTablet) {
      Row({ space: 20 }) {
        this.statusFilter();
        this.groupFilter();
      }
      .width(this.contentFrame().width)
      .height(36)
      .alignItems(VerticalAlign.Top)
      .margin({ top: TOK_SPACE_XS });
    } else {
      Column({ space: TOK_SPACE_XS }) {
        this.statusFilter();
        this.groupFilter();
      }
      .width(this.contentFrame().width)
      .margin({ top: TOK_SPACE_XS });
    }
  }

  @Builder
  private categoryFilter() {
    Scroll() {
      Row({ space: TOK_SPACE_XS }) {
        ForEach(['all', 'novel', 'comic', 'music', 'download', 'external', 'other'], (category: string) => {
          Text(category === 'all' ? '全部类型' : readerSourceCategoryLabel(category as ReaderSourceCategory))
            .fontFamily('ReaderNotoSansSC')
            .fontSize(11)
            .fontColor(this.categoryValue === category ? TOK_ON_PRIMARY : TOK_INK)
            .backgroundColor(this.categoryValue === category ? TOK_PRIMARY_DARK : TOK_CARD_BG)
            .borderRadius(16)
            .padding({ left: 12, right: 12 })
            .height(32)
            .id(`source-category-${category}`)
            .onClick((): void => {
              this.categoryValue = category;
              this.rebuildSourceProjection();
            });
        }, (category: string): string => category);
      }
    }
    .scrollable(ScrollDirection.Horizontal)
    .scrollBar(BarState.Off)
    .width(this.contentFrame().width)
    .height(40)
    .margin({ top: TOK_SPACE_XS });
  }

  @Builder
  private statusFilter() {
    Row({ space: TOK_SPACE_XS }) {
      this.chip('全部', 58, this.statusValue === '全部', true);
      this.chip('启用', 58, this.statusValue === '启用', true);
      this.chip('异常', 58, this.statusValue === '异常', true);
      this.chip('未检测', 72, this.statusValue === '未检测', true);
      // 原稿保留该视觉位，但没有稳定业务定义；禁用比伪造筛选语义更诚实。
      this.chip('自定义', 72, false, false);
    }
    .width(this.filterControlWidth())
    .height(32)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private chip(label: string, width: number, active: boolean, enabled: boolean) {
    Text(label)
      .width(this.statusChipWidth(width))
      .height(32)
      .textAlign(TextAlign.Center)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Bold)
      .fontSize(11)
      .fontColor(active ? TOK_ON_PRIMARY : TOK_INK)
      .backgroundColor(active ? TOK_PRIMARY_DARK : TOK_CARD_BG)
      .border({ width: TOK_BORDER_W, color: active ? TOK_PRIMARY_DARK : CHIP_BORDER })
      .borderRadius(16)
      .maxLines(1)
      .opacity(enabled ? 1 : 0.45)
      .onClick((): void => {
        if (enabled) {
          this.statusValue = label;
          this.rebuildSourceProjection();
        }
      });
  }

  @Builder
  private groupFilter() {
    Row() {
      Image($r('app.media.source_group_folder')).width(15).height(15);
      Text('分组')
        .margin({ left: 12 })
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .fontColor(TOK_INK)
        .maxLines(1);
      ReaderSelect({
        value: this.groupValue,
        options: this.groupOptions(),
        controlWidth: this.groupSelectWidth(),
        isOpen: this.groupOpen,
        variant: 'sourceGroup',
        reduceMotion: this.reduceMotion,
        onToggle: (): void => {
          if (this.groupOptions().length > 1) {
            if (this.groupOpen) this.groupClosing = true;
            else { this.groupClosing = false; this.groupOpen = true; }
          }
        },
      })
      .margin({ left: 22 })
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        // Area.globalPosition 已是 vp 单位, 直接取用 (曾 px2vp 二次÷3.5 致面板错位)。
        this.groupX = Number(newValue.globalPosition.x);
        this.groupY = Number(newValue.globalPosition.y);
      });
    }
    .width(this.filterControlWidth())
    .height(36)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private sourceList() {
    List() {
      // LazyForEach owns an explicit data source so an empty-to-populated Core
      // load and later filter replacements can notify ArkUI after mount. A
      // reusable Repeat over a derived array retained zero stale rows on API
      // 23 even though the surrounding count text had already updated.
      LazyForEach(this.sourceDataSource, (source: BookSource) => {
        ListItem() {
          this.sourceRow(source);
        }
      }, (source: BookSource): string => this.sourceRenderKey(source));
    }
    .width('100%')
    .layoutWeight(1)
    .margin({ top: TOK_SPACE_CONTROL_INLINE })
    .scrollBar(BarState.Off);
    // P0 add-source flow: a first-run visit (e.g. from Search's
    // sourceRequired state) must not land on a silent blank list; the bottom
    // "＋ 新增书源" action stays available below.
    if (this.sources.length === 0 && this.statusKind !== 'loading') {
      Column({ space: TOK_SPACE_XS }) {
        Text('暂无书源')
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(15)
          .lineHeight(22)
          .fontColor(TOK_INK);
        Text('点击下方「＋ 新增书源」导入 Legado 书源 JSON')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(12)
          .lineHeight(18)
          .fontColor(TOK_MUTED);
      }
      .width('100%')
      .margin({ top: 64 })
      .alignItems(HorizontalAlign.Center);
    }
  }

  @Builder
  private sourceRow(source: BookSource) {
    Row({ space: TOK_SPACE_XS }) {
      Column({ space: TOK_SPACE_XS }) {
        Text(source.name)
          .width('100%')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .lineHeight(15.34)
          .fontColor(TOK_INK)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.sourceMeta(source))
          .width('100%')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Regular)
          .fontSize(10)
          .lineHeight(12.5)
          .fontColor(TOK_MUTED)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);

      this.detectButton(source);

      this.statusBadge(
        this.statusBadgeBackground(source),
        this.statusBadgeDot(source),
      );

      this.sourceSwitch(source.enabled, (): void => this.onToggleSource(source.sourceId, !source.enabled));

      if (source.loginUrl !== undefined) {
        this.loginButton(source);
      }
    }
    .width(this.contentFrame().width)
    .height(70)
    .padding({ left: TOK_SPACE_SM })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: TOK_BORDER_W }, color: TOK_ROW_DIVIDER });
  }

  @Builder
  private detectButton(source: BookSource) {
    Stack({ alignContent: Alignment.Center }) {
      Text(source.checkState === 'checking' ? '检测中' : '检测')
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(11)
        .fontColor(TOK_INK)
        .maxLines(1);
    }
    .width(44)
    .height(28)
    .borderRadius(7)
    .backgroundColor(TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: CHIP_BORDER })
    .opacity(source.checkState === 'checking' ? 0.62 : 1)
    .onClick((): void => {
      if (source.checkState !== 'checking') {
        this.onDetectSource(source.sourceId);
      }
    });
  }

  @Builder
  private loginButton(source: BookSource) {
    Stack({ alignContent: Alignment.Center }) {
      Text('登录')
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(11)
        .fontColor(TOK_PRIMARY_DARK)
        .maxLines(1);
    }
    .width(44)
    .height(28)
    .borderRadius(7)
    .backgroundColor(TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: CHIP_BORDER })
    .onClick((): void => this.onLoginSource(source.sourceId));
  }

  @Builder
  private statusBadge(bg: string, dot: string) {
    StatusBadge({ bg: bg, dot: dot, radius: 999 });
  }

  @Builder
  private sourceSwitch(value: boolean, onTap: () => void) {
    ReaderToggle({ value: value, radius: 999, onToggle: onTap });
  }

  @Builder
  private bottomActionBar() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      Stack({ alignContent: Alignment.Center }) {
        Text('批量管理')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .fontColor(TOK_INK)
          .maxLines(1);
      }
      .layoutWeight(1)
      .height(44)
      .borderRadius(8)
      .backgroundColor(TOK_SURFACE_SOLID)
      .border({ width: TOK_BORDER_W, color: SEARCH_FIELD_BORDER })
      .onClick((): void => this.onOpenTools());

      Stack({ alignContent: Alignment.Center }) {
        Row({ space: TOK_SPACE_XS }) {
          Image($r('app.media.source_add'))
            .width(18)
            .height(18);
          Text('新增书源')
            .fontFamily('ReaderNotoSansSC')
            .fontWeight(FontWeight.Bold)
            .fontSize(13)
            .fontColor(TOK_ON_PRIMARY)
            .maxLines(1);
        }
        .alignItems(VerticalAlign.Center);
      }
      .layoutWeight(1)
      .height(44)
      .borderRadius(8)
      .backgroundColor(TOK_PRIMARY_DARK)
      .onClick((): void => this.onAddSource());
    }
    .width(this.contentFrame().width)
    .height(44)
    .alignItems(VerticalAlign.Center)
    .margin({ top: TOK_SPACE_SM, bottom: TOK_SPACE_MD });
  }

  private sourceMeta(source: BookSource): string {
    const category = readerSourceCategoryLabel(source.category);
    if (source.checkState !== undefined && source.checkState !== 'unchecked' &&
      source.checkMessage !== undefined && source.checkMessage.length > 0) {
      return `${category} · ${source.checkMessage}`;
    }
    if (source.baseUrl.length > 0) {
      return `${category} · ${source.baseUrl}`;
    }
    return `${category} · ${source.enabled ? '已启用' : '已禁用'}`;
  }

  private sourceRenderKey(source: BookSource): string {
    return `source-${source.sourceId}-${source.name}-${source.baseUrl}-${source.group ?? ''}-${source.category}-` +
      `${source.loginUrl ?? ''}-${source.enabled}-${source.checkState ?? 'unchecked'}-` +
      `${source.checkMessage ?? ''}`;
  }

  private statusBadgeBackground(source: BookSource): string {
    if (source.checkState === 'passed') {
      return STATUS_GOOD_BG;
    }
    if (source.checkState === 'failed') {
      return STATUS_ERROR_BG;
    }
    return STATUS_MUTED_BG;
  }

  private statusBadgeDot(source: BookSource): string {
    if (source.checkState === 'passed') {
      return STATUS_GOOD_DOT;
    }
    if (source.checkState === 'failed') {
      return STATUS_ERROR_DOT;
    }
    return STATUS_MUTED_DOT;
  }

  private enabledCount(): number {
    return this.sources.filter((source) => source.enabled).length;
  }

  private statsText(): string {
    const filteredCount = this.projectedSources.length;
    const prefix = filteredCount === this.sources.length ? `${this.sources.length} 个书源` :
      `显示 ${filteredCount}/${this.sources.length} 个书源`;
    return `${prefix} · ${this.enabledCount()} 个启用`;
  }

  private filteredSources(): BookSource[] {
    const query = this.searchQuery.trim().toLowerCase();
    return this.sources.filter((source: BookSource): boolean => {
      const matchesQuery = query.length === 0 || source.name.toLowerCase().includes(query) ||
        source.baseUrl.toLowerCase().includes(query);
      const matchesGroup = this.groupValue === '全部分组' || source.group === this.groupValue;
      const matchesCategory = this.categoryValue === 'all' || source.category === this.categoryValue;
      return matchesQuery && matchesGroup && matchesCategory && this.matchesStatus(source);
    });
  }

  private onSourcesChanged(): void {
    this.rebuildSourceProjection();
  }

  private rebuildSourceProjection(): void {
    const projected = this.filteredSources();
    this.sourceDataSource.replace(projected);
    this.projectedSources = projected;
  }

  private matchesStatus(source: BookSource): boolean {
    if (this.statusValue === '启用') {
      return source.enabled;
    }
    if (this.statusValue === '异常') {
      return source.checkState === 'failed';
    }
    if (this.statusValue === '未检测') {
      return source.checkState === undefined || source.checkState === 'unchecked';
    }
    return true;
  }

  private groupOptions(): string[] {
    const options: string[] = ['全部分组'];
    for (let i = 0; i < this.groups.length; i++) {
      const group = this.groups[i].trim();
      if (group !== '' && group !== '全部分组' && options.indexOf(group) < 0) {
        options.push(group);
      }
    }
    for (const source of this.sources) {
      const group = source.group?.trim() ?? '';
      if (group !== '' && group !== '全部分组' && options.indexOf(group) < 0) {
        options.push(group);
      }
    }
    return options;
  }

  private contentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const metrics = ReaderWindowCoordinator.metrics();
    const containerWidth = this.viewportWidth > 0 ? this.viewportWidth : metrics.windowRect.width;
    return resolveHorizontalFrame(
      containerWidth,
      readerVisualSafeLeft(metrics),
      readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(TOK_CONTENT_MAX_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET),
    );
  }

  private filterControlWidth(): number {
    if (!this.isTablet) {
      return this.contentFrame().width;
    }
    return Math.max(0, (this.contentFrame().width - 20) / 2);
  }

  private statusChipWidth(designWidth: number): number {
    const gapWidth = TOK_SPACE_XS * 4;
    const availableForChips = Math.max(0, this.filterControlWidth() - gapWidth);
    return designWidth * Math.min(1, availableForChips / 318);
  }

  private groupSelectWidth(): number {
    return Math.max(0, this.filterControlWidth() - (GROUP_FILTER_WIDTH - GROUP_SELECT_WIDTH));
  }

  private numericAreaLength(value: Length): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
}
