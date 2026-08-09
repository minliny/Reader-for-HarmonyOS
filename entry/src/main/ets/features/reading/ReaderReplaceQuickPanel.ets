import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_BORDER_W,
  TOK_LINE,
  TOK_LINE_STRONG,
  TOK_READ_INK,
  TOK_READ_PRIMARY,
  TOK_SURFACE_PANEL,
} from '../common/ReaderTokens';
import {
  createHiddenReaderReplaceQuickState,
  type ReaderReplaceQuickState,
  type ReaderReplaceRule,
} from './ReaderReplaceQuickState';

/**
 * Figma Quick Replace content only: Phone `942:54` / `912:68`,
 * Tablet `942:56` / `914:64`.
 *
 * Hidden state deliberately renders nothing because Figma defines no empty,
 * loading, short-list, or error visual. Preview has no raw pre-processing
 * text, and Full Replace has no production page, so both footer actions remain
 * non-interactive without inventing a disabled design.
 */
@Component
export struct ReaderReplaceQuickPanel {
  @Prop isTablet: boolean = false;
  @Prop state: ReaderReplaceQuickState = createHiddenReaderReplaceQuickState();
  onClose: () => void = (): void => {};
  onToggleRule: (ruleId: number, isEnabled: boolean) => void =
    (_ruleId: number, _isEnabled: boolean): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    if (this.state.kind === 'ready') {
      this.readyPanel();
    }
  }

  @Builder
  private readyPanel() {
    Column({ space: 4 }) {
      this.header();
      this.ruleBody();
    }
    .width(this.panelWidth())
    .height(190)
    .padding({ left: 11, right: 11, top: 13, bottom: 13 })
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private header() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('替换规则')
        .width(this.contentWidth() - 50)
        .height(14)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .lineHeight(14.04)
        .fontColor(TOK_READ_INK)
        .maxLines(1)
        .position({ x: 8, y: 7 });

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.reader_replace_close'))
          .width(11)
          .height(11);
      }
      .width(28)
      .height(28)
      .borderRadius(6)
      .position({ x: this.contentWidth() - 36, y: 0 })
      .accessibilityText('关闭替换规则')
      .onClick((): void => this.onClose());
    }
    .width(this.contentWidth())
    .height(28)
    .border({ width: { bottom: TOK_BORDER_W }, color: TOK_LINE });
  }

  @Builder
  private ruleBody() {
    Column({ space: 3 }) {
      Column() {
        if (this.state.kind === 'ready') {
          ForEach(this.state.rules, (rule: ReaderReplaceRule) => {
            this.ruleRow(rule);
          }, (rule: ReaderReplaceRule): string => `reader-replace-quick-${rule.id}`);
        }
      }
      .width('100%')
      .height(93)
      .alignItems(HorizontalAlign.Start)
      .clip(true);

      this.footer();
    }
    .width(this.contentWidth())
    .height(132)
    .padding({ left: 7, right: 7, top: 3, bottom: 5 })
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private ruleRow(rule: ReaderReplaceRule) {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        Row()
          .width(12)
          .height(12)
          .backgroundColor('#FFFFFF')
          .borderRadius(6)
          .position({ x: rule.isEnabled ? 13 : 2, y: 2 });
      }
      .width(27)
      .height(16)
      .backgroundColor(rule.isEnabled ? TOK_READ_PRIMARY : '#C9C5BE')
      .borderRadius(999)
      .position({ x: 5, y: 6 });

      Text(rule.name)
        .width(this.ruleTextWidth())
        .height(13)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(9)
        .lineHeight(13)
        .fontColor(TOK_READ_INK)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .position({ x: 42, y: 7.5 });
    }
    .width('100%')
    .height(28)
    .border({ width: { bottom: TOK_BORDER_W }, color: TOK_LINE })
    .accessibilityText(`${rule.name}，${rule.isEnabled ? '已开启' : '已关闭'}`)
    .onClick((): void => this.onToggleRule(rule.id, !rule.isEnabled));
  }

  @Builder
  private footer() {
    Row({ space: 6 }) {
      this.footerButton('preview');
      this.footerButton('management');
    }
    .width('100%')
    .height(28);
  }

  @Builder
  private footerButton(kind: string) {
    Row({ space: 5 }) {
      Image($r(kind === 'preview' ?
        'app.media.reader_replace_preview' : 'app.media.reader_replace_manage'))
        .width(11)
        .height(11);
      Text(kind === 'preview' ? '预览效果' : '完整管理')
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(8)
        .fontColor(kind === 'preview' ? TOK_READ_INK : '#FFFFFF')
        .textAlign(TextAlign.Center)
        .maxLines(1);
    }
    .width(kind === 'preview' ? this.previewButtonWidth() : this.managementButtonWidth())
    .height(28)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(kind === 'preview' ? TOK_SURFACE_PANEL : TOK_READ_PRIMARY)
    .border({
      width: TOK_BORDER_W,
      color: kind === 'preview' ? TOK_LINE_STRONG : Color.Transparent,
    })
    .borderRadius(8)
    .enabled(false)
    .accessibilityText(kind === 'preview' ?
      '预览效果，原始正文不可用' : '完整管理，完整替换页尚未提供');
  }

  private panelWidth(): number {
    return this.isTablet ? 262 : 286;
  }

  private contentWidth(): number {
    return this.isTablet ? 240 : 264;
  }

  private ruleTextWidth(): number {
    return this.isTablet ? 179 : 203;
  }

  private previewButtonWidth(): number {
    return this.isTablet ? 88 : 97.59;
  }

  private managementButtonWidth(): number {
    return this.isTablet ? 132 : 146.41;
  }
}
