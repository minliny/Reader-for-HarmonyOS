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

const REPLACE_PANEL_WIDTH_PHONE = 286;
const REPLACE_PANEL_WIDTH_TABLET = 262;
const REPLACE_PANEL_PADDING_X = 11;
const REPLACE_PANEL_PADDING_Y = 13;
const REPLACE_HEADER_HEIGHT = 28;
const REPLACE_CLOSE_SIZE = 28;
const REPLACE_HEADER_BODY_GAP = 4;
const REPLACE_RULES_VIEWPORT_HEIGHT = 93;
const REPLACE_RULE_ROW_HEIGHT = 28;
const REPLACE_RULE_BODY_PADDING_X = 7;
const REPLACE_RULE_BODY_PADDING_TOP = 3;
const REPLACE_RULE_BODY_PADDING_BOTTOM = 5;
const REPLACE_RULE_FOOTER_GAP = 3;
const REPLACE_FOOTER_HEIGHT = 28;
const REPLACE_FOOTER_BUTTON_GAP = 6;
const REPLACE_PREVIEW_WIDTH_PHONE = 97.59;
const REPLACE_PREVIEW_WIDTH_TABLET = 88;
const REPLACE_RULE_TEXT_RESERVED_WIDTH = 61;
const REPLACE_RULE_BODY_HEIGHT = REPLACE_RULE_BODY_PADDING_TOP + REPLACE_RULES_VIEWPORT_HEIGHT +
  REPLACE_RULE_FOOTER_GAP + REPLACE_FOOTER_HEIGHT + REPLACE_RULE_BODY_PADDING_BOTTOM;
const REPLACE_PANEL_HEIGHT = REPLACE_PANEL_PADDING_Y * 2 + REPLACE_HEADER_HEIGHT +
  REPLACE_HEADER_BODY_GAP + REPLACE_RULE_BODY_HEIGHT;

/**
 * Figma Quick Replace content only: Phone `942:54` / `912:68`,
 * Tablet `942:56` / `914:64`.
 *
 * Hidden state is reserved for not-loaded or failed data. A valid Core list,
 * including zero, one, or two rules, renders this panel. Preview has no raw
 * pre-processing text, so Preview remains visible and non-interactive. Full
 * management reuses the application's existing RulesManagementPage.
 */
@Component
export struct ReaderReplaceQuickPanel {
  @Prop isTablet: boolean = false;
  @Prop state: ReaderReplaceQuickState = createHiddenReaderReplaceQuickState();
  onClose: () => void = (): void => {};
  onToggleRule: (ruleId: number, isEnabled: boolean) => void =
    (_ruleId: number, _isEnabled: boolean): void => {};
  onOpenManagement: () => void = (): void => {};

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
    Column({ space: REPLACE_HEADER_BODY_GAP }) {
      this.header();
      this.ruleBody();
    }
    .width(this.panelWidth())
    .height(REPLACE_PANEL_HEIGHT)
    .padding({
      left: REPLACE_PANEL_PADDING_X,
      right: REPLACE_PANEL_PADDING_X,
      top: REPLACE_PANEL_PADDING_Y,
      bottom: REPLACE_PANEL_PADDING_Y,
    })
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
      .width(REPLACE_CLOSE_SIZE)
      .height(REPLACE_CLOSE_SIZE)
      .borderRadius(6)
      .position({ x: this.contentWidth() - 36, y: 0 })
      .accessibilityText('关闭替换规则')
      .onClick((): void => this.onClose());
    }
    .width(this.contentWidth())
    .height(REPLACE_HEADER_HEIGHT)
    .border({ width: { bottom: TOK_BORDER_W }, color: TOK_LINE });
  }

  @Builder
  private ruleBody() {
    Column({ space: REPLACE_RULE_FOOTER_GAP }) {
      Column() {
        if (this.state.kind === 'ready') {
          if (this.state.rules.length === 0) {
            Text('暂无替换规则')
              .width('100%')
              .height(REPLACE_RULES_VIEWPORT_HEIGHT)
              .fontFamily('ReaderNotoSansSC')
              .fontWeight(FontWeight.Regular)
              .fontSize(9)
              .fontColor(TOK_READ_INK)
              .textAlign(TextAlign.Center);
          } else {
            ForEach(this.state.rules, (rule: ReaderReplaceRule) => {
              this.ruleRow(rule);
            }, (rule: ReaderReplaceRule): string => `reader-replace-quick-${rule.id}`);
          }
        }
      }
      .width('100%')
      .height(REPLACE_RULES_VIEWPORT_HEIGHT)
      .alignItems(HorizontalAlign.Start)
      .clip(true);

      this.footer();
    }
    .width(this.contentWidth())
    .height(REPLACE_RULE_BODY_HEIGHT)
    .padding({
      left: REPLACE_RULE_BODY_PADDING_X,
      right: REPLACE_RULE_BODY_PADDING_X,
      top: REPLACE_RULE_BODY_PADDING_TOP,
      bottom: REPLACE_RULE_BODY_PADDING_BOTTOM,
    })
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
    .height(REPLACE_RULE_ROW_HEIGHT)
    .border({ width: { bottom: TOK_BORDER_W }, color: TOK_LINE })
    .accessibilityText(`${rule.name}，${rule.isEnabled ? '已开启' : '已关闭'}`)
    .onClick((): void => this.onToggleRule(rule.id, !rule.isEnabled));
  }

  @Builder
  private footer() {
    Row({ space: REPLACE_FOOTER_BUTTON_GAP }) {
      this.footerButton('preview');
      this.footerButton('management');
    }
    .width('100%')
    .height(REPLACE_FOOTER_HEIGHT);
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
    .height(REPLACE_FOOTER_HEIGHT)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(kind === 'preview' ? TOK_SURFACE_PANEL : TOK_READ_PRIMARY)
    .border({
      width: TOK_BORDER_W,
      color: kind === 'preview' ? TOK_LINE_STRONG : Color.Transparent,
    })
    .borderRadius(8)
    .enabled(kind === 'management')
    .opacity(kind === 'management' ? 1 : 0.55)
    .accessibilityText(kind === 'preview' ?
      '预览效果，原始正文不可用' : '打开完整替换规则管理')
    .onClick((): void => {
      if (kind === 'management') {
        this.onOpenManagement();
      }
    });
  }

  private panelWidth(): number {
    return this.isTablet ? REPLACE_PANEL_WIDTH_TABLET : REPLACE_PANEL_WIDTH_PHONE;
  }

  private contentWidth(): number {
    return this.panelWidth() - REPLACE_PANEL_PADDING_X * 2;
  }

  private ruleTextWidth(): number {
    return this.contentWidth() - REPLACE_RULE_TEXT_RESERVED_WIDTH;
  }

  private previewButtonWidth(): number {
    return this.isTablet ? REPLACE_PREVIEW_WIDTH_TABLET : REPLACE_PREVIEW_WIDTH_PHONE;
  }

  private managementButtonWidth(): number {
    return this.contentWidth() - REPLACE_RULE_BODY_PADDING_X * 2 - REPLACE_FOOTER_BUTTON_GAP -
      this.previewButtonWidth();
  }
}
