import { registerReaderFonts } from '../common/ReaderFonts';
import { TOK_BORDER_W } from '../common/ReaderTokens';
import type { ReaderAppearanceSnapshot } from './ReaderAppearanceState';
import { createDefaultReaderAppearanceSnapshot } from './ReaderAppearanceState';
import { readerThemePalette, type ReaderThemePalette } from './ReaderThemePalettes';
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
 * including zero, one, or two rules, renders this panel. Preview delegates to
 * Core's raw chapter cache. Full management reuses the application's existing
 * RulesManagementPage.
 */
@Component
export struct ReaderReplaceQuickPanel {
  @Prop isTablet: boolean = false;
  @Prop state: ReaderReplaceQuickState = createHiddenReaderReplaceQuickState();
  @Prop appearanceSnapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();

  private palette(): ReaderThemePalette {
    return readerThemePalette(this.appearanceSnapshot.activeTheme);
  }
  onClose: () => void = (): void => {};
  onToggleRule: (ruleId: number, isEnabled: boolean) => void =
    (_ruleId: number, _isEnabled: boolean): void => {};
  onPreview: () => void = (): void => {};
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
    .width('100%')
    .constraintSize({ maxWidth: this.panelWidth() })
    .height(REPLACE_PANEL_HEIGHT)
    .padding({
      left: REPLACE_PANEL_PADDING_X,
      right: REPLACE_PANEL_PADDING_X,
      top: REPLACE_PANEL_PADDING_Y,
      bottom: REPLACE_PANEL_PADDING_Y,
    })
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(this.palette().surfacePanelSoft)
    .border({ width: TOK_BORDER_W, color: this.palette().lineStrong })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private header() {
    Row() {
      Text('替换规则')
        .layoutWeight(1)
        .constraintSize({ maxWidth: this.contentWidth() - 50 })
        .height(14)
        .margin({ left: 8 })
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .lineHeight(14.04)
        .fontColor(this.palette().ink)
        .maxLines(1);

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.reader_replace_close'))
          .width(11)
          .height(11);
      }
      .width(REPLACE_CLOSE_SIZE)
      .height(REPLACE_CLOSE_SIZE)
      .margin({ left: 6, right: 8 })
      .borderRadius(6)
      .accessibilityText('关闭替换规则')
      .onClick((): void => this.onClose());
    }
    .width('100%')
    .constraintSize({ maxWidth: this.contentWidth() })
    .height(REPLACE_HEADER_HEIGHT)
    .alignItems(VerticalAlign.Center)
    .border({ width: { bottom: TOK_BORDER_W }, color: this.palette().borderSoft });
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
              .fontColor(this.palette().ink)
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
    .width('100%')
    .constraintSize({ maxWidth: this.contentWidth() })
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
    Row() {
      Stack({ alignContent: Alignment.TopStart }) {
        Row()
          .width(12)
          .height(12)
          .backgroundColor(this.palette().knob)
          .borderRadius(6)
          .position({ x: rule.isEnabled ? 13 : 2, y: 2 });
      }
      .width(27)
      .height(16)
      .margin({ left: 5 })
      .backgroundColor(rule.isEnabled ? this.palette().primary : this.palette().handle)
      .borderRadius(999)
      .clip(true);

      Text(rule.name)
        .layoutWeight(1)
        .constraintSize({ maxWidth: this.ruleTextWidth() })
        .height(13)
        .margin({ left: 10, right: 5 })
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(9)
        .lineHeight(13)
        .fontColor(this.palette().ink)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width('100%')
    .height(REPLACE_RULE_ROW_HEIGHT)
    .alignItems(VerticalAlign.Center)
    .border({ width: { bottom: TOK_BORDER_W }, color: this.palette().borderSoft })
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
        .fontColor(kind === 'preview' ? this.palette().ink : this.palette().onPrimary)
        .textAlign(TextAlign.Center)
        .maxLines(1);
    }
    .width(kind === 'preview' ? this.previewButtonWidth() : this.managementButtonWidth())
    .constraintSize({
      maxWidth: kind === 'preview' ? this.previewButtonWidth() : this.managementButtonWidth(),
    })
    .layoutWeight(kind === 'management' ? 1 : 0)
    .height(REPLACE_FOOTER_HEIGHT)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(kind === 'preview' ? this.palette().surfacePanelSoft : this.palette().primary)
    .border({
      width: TOK_BORDER_W,
      color: kind === 'preview' ? this.palette().lineStrong : Color.Transparent,
    })
    .borderRadius(8)
    .enabled(kind === 'management' || (this.state.kind === 'ready' && this.state.previewAvailable))
    .opacity(1)
    .accessibilityText(kind === 'preview' ?
      '预览当前章节替换效果' : '打开完整替换规则管理')
    .onClick((): void => {
      if (kind === 'preview') {
        this.onPreview();
      } else {
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
