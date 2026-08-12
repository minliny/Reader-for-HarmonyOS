// Source Management — rebuilt 2026-08-05 against live Figma nodes
// 943:4281 (Phone 390×844) / 943:4745 (Tablet 760×960).
// Structural notes: search field h38 r8 + status filter (5 chips h32 r16)
// + group filter (folder icon + select) above a 70-tall source list whose
// rows carry status badge + bordered 检测 button + 44×24 switch + more;
// bottom action bar = 批量管理 + ＋新增书源. Content inset is 19vp.
import {
  type BookSource,
} from './SourceGateway';
import type { SourceManagementStatusKind } from './SourceOrchestrator';
import { registerReaderFonts } from '../common/ReaderFonts';
import { PageBackBar } from '../common/PageBackBar';
import { ReaderToggle } from '../common/ReaderToggle';
import { ReaderSelect } from '../common/ReaderSelect';
import { ReaderSelectPanel } from '../common/ReaderSelectPanel';
import { StatusBadge } from '../common/StatusBadge';
import {
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_CONTENT_MAX_W_PHONE,
  TOK_CONTENT_MAX_W_TABLET,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_PRIMARY_DARK,
  TOK_ROW_DIVIDER,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SURFACE_SOLID,
} from '../common/ReaderTokens';

const GROUP_FILTER_WIDTH = 350;
const GROUP_SELECT_WIDTH = 277;
const SEARCH_FIELD_BG = '#D1FFFCF8';      // rgba(255,252,248,0.82)
const SEARCH_FIELD_BORDER = '#75B4A697';  // rgba(180,166,151,0.46)
const CHIP_BORDER = '#85B4A697';   // rgba(180,166,151,0.52)
const STATUS_GOOD_BG = '#212B895C';   // rgba(43,137,92,0.13)
const STATUS_GOOD_DOT = '#28704E';
const STATUS_MUTED_BG = '#1F8C8276';  // rgba(140,130,118,0.12)
const STATUS_MUTED_DOT = '#8C8276';
const STATUS_ERROR_BG = '#21A8584D';
const STATUS_ERROR_DOT = '#A8584D';

@Component
export struct SourceManagementPage {
  @Prop sources: BookSource[];
  // 额外分组可由调用方补充；常规选项直接来自 Core 返回的原始
  // bookSource.bookSourceGroup，不按启用状态等 UI 属性伪造。
  @Prop groups: string[] = [];
  @Prop isTablet: boolean;
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
  @State private groupValue: string = '全部分组';
  @State private groupOpen: boolean = false;
  // 展开面板锚点: 触发条全局坐标 - 根 Stack 原点 = 面板相对根 Stack 位置。
  @State private groupX: number = 0;
  @State private groupY: number = 0;
  @State private originX: number = 0;
  @State private originY: number = 0;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
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
          this.sourceList();
          this.bottomActionBar();
        }
        .layoutWeight(1)
        .width('100%');
      }
      .width('100%')
      .height('100%')
      .backgroundColor(TOK_PAPER)
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        // Area.globalPosition 已是 vp 单位, 直接取用 (曾 px2vp 二次÷3.5 致面板错位)。
        this.originX = Number(newValue.globalPosition.x);
        this.originY = Number(newValue.globalPosition.y);
      });

      if (this.groupOpen) {
        ReaderSelectPanel({
          value: this.groupValue,
          options: this.groupOptions(),
          controlWidth: GROUP_SELECT_WIDTH,
          x: this.groupX - this.originX,
          y: this.groupY - this.originY,
          onSelect: (opt: string): void => {
            this.groupValue = opt;
            this.groupOpen = false;
          },
        });
      }
    }
    .width('100%')
    .height('100%');
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
    Row({ space: TOK_SPACE_XS }) {
      Image($r('app.media.search_mag')).width(13).height(13);
      TextInput({ text: this.searchQuery, placeholder: '搜索书源名称或域名' })
        .layoutWeight(1)
        .height(36)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(12)
        .fontColor(TOK_INK)
        .placeholderColor(TOK_MUTED)
        .backgroundColor('#00FFFFFF')
        .padding(0)
        .onChange((value: string): void => { this.searchQuery = value; });
    }
    .width(this.contentWidth())
    .height(38)
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
    .backgroundColor(SEARCH_FIELD_BG)
    .border({ width: TOK_BORDER_W, color: SEARCH_FIELD_BORDER })
    .borderRadius(8)
    .alignItems(VerticalAlign.Center)
    .margin({ top: TOK_SPACE_XS });
  }

  @Builder
  private statsRow() {
    Text(this.statsText())
      .width(this.contentWidth())
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
    .width(this.contentWidth())
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
      .width(this.contentWidth())
      .height(36)
      .alignItems(VerticalAlign.Top)
      .margin({ top: TOK_SPACE_XS });
    } else {
      Column({ space: TOK_SPACE_XS }) {
        this.statusFilter();
        this.groupFilter();
      }
      .width(this.contentWidth())
      .margin({ top: TOK_SPACE_XS });
    }
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
    .width(GROUP_FILTER_WIDTH)
    .height(32)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private chip(label: string, width: number, active: boolean, enabled: boolean) {
    Text(label)
      .width(width)
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
        }
      });
  }

  @Builder
  private groupFilter() {
    Row() {
      Image($r('app.media.directory_directory')).width(15).height(15);
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
        controlWidth: GROUP_SELECT_WIDTH,
        isOpen: this.groupOpen,
        onToggle: (): void => {
          if (this.groupOptions().length > 1) {
            this.groupOpen = !this.groupOpen;
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
    .width(GROUP_FILTER_WIDTH)
    .height(36)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private sourceList() {
    List() {
      ForEach(this.filteredSources(), (source: BookSource) => {
        ListItem() {
          this.sourceRow(source);
        }
      }, (source: BookSource): string =>
        `source-${source.sourceId}-${source.enabled}-${source.checkState}-${source.checkMessage}`);
    }
    .width('100%')
    .layoutWeight(1)
    .margin({ top: TOK_SPACE_CONTROL_INLINE })
    .scrollBar(BarState.Off);
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
      } else {
        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.bookshelf_more')).width(20).height(20);
        }
        .width(44)
        .height(44)
        .borderRadius(22);
      }
    }
    .width(this.contentWidth())
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
          Text('＋')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(20)
            .fontColor(TOK_ON_PRIMARY);
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
    .width(this.contentWidth())
    .height(44)
    .alignItems(VerticalAlign.Center)
    .margin({ top: TOK_SPACE_SM, bottom: TOK_SPACE_MD });
  }

  private sourceMeta(source: BookSource): string {
    if (source.checkState !== undefined && source.checkState !== 'unchecked' &&
      source.checkMessage !== undefined && source.checkMessage.length > 0) {
      return source.checkMessage;
    }
    if (source.baseUrl.length > 0) {
      return source.baseUrl;
    }
    return source.enabled ? '已启用' : '已禁用';
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
    const filteredCount = this.filteredSources().length;
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
      return matchesQuery && matchesGroup && this.matchesStatus(source);
    });
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

  private contentWidth(): number {
    return this.isTablet ? TOK_CONTENT_MAX_W_TABLET : TOK_CONTENT_MAX_W_PHONE;
  }
}
