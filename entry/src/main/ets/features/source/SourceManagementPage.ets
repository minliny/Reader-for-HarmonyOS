// Source Management — rebuilt 2026-08-05 against live Figma nodes
// 943:4281 (Phone 390×844) / 943:4745 (Tablet 760×960).
// Structural notes: search field h38 r8 + status filter (5 chips h32 r16)
// + group filter (folder icon + select) above a 70-tall source list whose
// rows carry status badge + bordered 检测 button + 44×24 switch + more;
// bottom action bar = 批量管理 + ＋新增书源. Content inset is 19vp.
import {
  type BookSource,
} from './SourceGateway';
import { registerReaderFonts } from '../common/ReaderFonts';
import { ReaderToggle } from '../common/ReaderToggle';
import { ReaderSelect } from '../common/ReaderSelect';
import { StatusBadge } from '../common/StatusBadge';
import {
  TOK_CARD_BG,
  TOK_INK,
  TOK_MUTED,
  TOK_PAPER,
  TOK_PRIMARY_DARK,
  TOK_ROW_DIVIDER,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';

const PHONE_CONTENT_WIDTH = 350;   // 390 - 2*19
const TABLET_CONTENT_WIDTH = 722;  // 760 - 2*19
const GROUP_FILTER_WIDTH = 350;
const SEARCH_FIELD_BG = '#D1FFFCF8';      // rgba(255,252,248,0.82)
const SEARCH_FIELD_BORDER = '#75B4A697';  // rgba(180,166,151,0.46)
const CHIP_BORDER = '#85B4A697';   // rgba(180,166,151,0.52)
const FIELD_BG = '#FFFCF8';        // surface
const STATUS_GOOD_BG = '#212B895C';   // rgba(43,137,92,0.13)
const STATUS_GOOD_DOT = '#28704E';
const STATUS_MUTED_BG = '#1F8C8276';  // rgba(140,130,118,0.12)
const STATUS_MUTED_DOT = '#8C8276';

@Component
export struct SourceManagementPage {
  @Prop sources: BookSource[];
  @Prop isTablet: boolean;
  onBack: () => void = (): void => {};
  onToggleSource: (id: string, enabled: boolean) => void = (_id: string, _enabled: boolean): void => {};
  @State private groupValue: string = '全部分组';
  @State private groupOpen: boolean = false;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column() {
      this.backBar();
      Column() {
        this.searchField();
        this.statsRow();
        this.filterArea();
        this.sourceList();
        this.bottomActionBar();
      }
      .layoutWeight(1)
      .width('100%');
    }
    .width('100%')
    .height('100%')
    .backgroundColor(TOK_PAPER);
  }

  @Builder
  private backBar() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.search_back')).width(24).height(24);
      }
      .width(44)
      .height(44)
      .borderRadius(22)
      .onClick((): void => this.onBack());

      Text('书源管理')
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(24)
        .lineHeight(33)
        .fontColor(TOK_INK)
        .maxLines(1)
        .layoutWeight(1);

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_more')).width(20).height(20);
      }
      .width(44)
      .height(44)
      .borderRadius(22);
    }
    .width('100%')
    .height(58)
    .padding({ left: 20, right: 20 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private searchField() {
    Row({ space: TOK_SPACE_XS }) {
      Image($r('app.media.search_mag')).width(13).height(13);
      Text('搜索书源名称或域名')
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(12)
        .fontColor(TOK_MUTED)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width(this.contentWidth())
    .height(38)
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
    .backgroundColor(SEARCH_FIELD_BG)
    .border({ width: 1, color: SEARCH_FIELD_BORDER })
    .borderRadius(8)
    .alignItems(VerticalAlign.Center)
    .margin({ top: TOK_SPACE_XS });
  }

  @Builder
  private statsRow() {
    Text(`${this.sources.length} 个书源 · ${this.enabledCount()} 个启用`)
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
      this.chip('全部', 58, true);
      this.chip('启用', 58, false);
      this.chip('异常', 58, false);
      this.chip('未检测', 72, false);
      this.chip('自定义', 72, false);
    }
    .width(GROUP_FILTER_WIDTH)
    .height(32)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private chip(label: string, width: number, active: boolean) {
    Text(label)
      .width(width)
      .height(32)
      .textAlign(TextAlign.Center)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Bold)
      .fontSize(11)
      .fontColor(active ? '#FFFFFF' : TOK_INK)
      .backgroundColor(active ? TOK_PRIMARY_DARK : TOK_CARD_BG)
      .border({ width: 1, color: active ? TOK_PRIMARY_DARK : CHIP_BORDER })
      .borderRadius(16)
      .maxLines(1);
  }

  @Builder
  private groupFilter() {
    Row() {
      Image($r('app.media.directory_directory')).width(15).height(15);
      Text('分组')
        .margin({ left: 11 })
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .fontColor(TOK_INK)
        .maxLines(1);
      ReaderSelect({
        value: this.groupValue,
        options: ['全部分组', '已启用', '已禁用'],
        isOpen: this.groupOpen,
        onToggle: (): void => {
          this.groupOpen = !this.groupOpen;
        },
        onSelect: (opt: string): void => {
          this.groupValue = opt;
          this.groupOpen = false;
        },
      })
      .margin({ left: 22 });
    }
    .width(GROUP_FILTER_WIDTH)
    .height(36)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private sourceList() {
    List() {
      ForEach(this.sources, (source: BookSource) => {
        ListItem() {
          this.sourceRow(source);
        }
      }, (source: BookSource): string => `source-${source.sourceId}`);
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

      this.detectButton();

      this.statusBadge(
        source.enabled ? STATUS_GOOD_BG : STATUS_MUTED_BG,
        source.enabled ? STATUS_GOOD_DOT : STATUS_MUTED_DOT,
      );

      this.sourceSwitch(source.enabled, (): void => this.onToggleSource(source.sourceId, !source.enabled));

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_more')).width(20).height(20);
      }
      .width(44)
      .height(44)
      .borderRadius(22);
    }
    .width(this.contentWidth())
    .height(70)
    .padding({ left: TOK_SPACE_SM })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: 0.5 }, color: TOK_ROW_DIVIDER });
  }

  @Builder
  private detectButton() {
    Stack({ alignContent: Alignment.Center }) {
      Text('检测')
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
    .border({ width: 1, color: CHIP_BORDER });
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
      .backgroundColor(FIELD_BG)
      .border({ width: 1, color: SEARCH_FIELD_BORDER });

      Stack({ alignContent: Alignment.Center }) {
        Row({ space: TOK_SPACE_XS }) {
          Text('＋')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(20)
            .fontColor('#FFFFFF');
          Text('新增书源')
            .fontFamily('ReaderNotoSansSC')
            .fontWeight(FontWeight.Bold)
            .fontSize(13)
            .fontColor('#FFFFFF')
            .maxLines(1);
        }
        .alignItems(VerticalAlign.Center);
      }
      .layoutWeight(1)
      .height(44)
      .borderRadius(8)
      .backgroundColor(TOK_PRIMARY_DARK);
    }
    .width(this.contentWidth())
    .height(44)
    .alignItems(VerticalAlign.Center)
    .margin({ top: TOK_SPACE_SM, bottom: TOK_SPACE_MD });
  }

  private sourceMeta(source: BookSource): string {
    if (source.baseUrl.length > 0) {
      return source.baseUrl;
    }
    return source.enabled ? '已启用' : '已禁用';
  }

  private enabledCount(): number {
    return this.sources.filter((source) => source.enabled).length;
  }

  private contentWidth(): number {
    return this.isTablet ? TABLET_CONTENT_WIDTH : PHONE_CONTENT_WIDTH;
  }
}
