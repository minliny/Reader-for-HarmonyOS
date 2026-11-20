import type { ReaderAppColorRole } from '../common/ReaderThemeRegistry';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderPressFeedback } from '../common/ReaderPressFeedback';
import type { ReaderTextStyle } from '../common/ReaderTypography';
import {
  TYPE_READER_AUTO_PAGE_RETAINED_QUICK_BACK_BACK,
  TYPE_READER_CONTROL_COLLAPSE_INTER,
  TYPE_READER_CONTROL_COLLAPSE_UI,
  TYPE_READER_DIRECTORY_COLLAPSE,
  TYPE_READER_SEARCH_RETAINED_QUICK_BACK_BACK,
} from '../common/ReaderTypography';

export type ReaderPanelCollapseSpecId = 'control-ui' | 'control-inter' | 'directory';

export interface ReaderPanelCollapseSpec {
  labelWidth: number | string;
  labelHeight: number;
  textStyle: ReaderTextStyle;
  surface: ReaderAppColorRole;
  textColor: ReaderAppColorRole;
}

const CONTROL_COLLAPSE_UI: ReaderPanelCollapseSpec = {
  labelWidth: 20,
  labelHeight: 14,
  textStyle: TYPE_READER_CONTROL_COLLAPSE_UI,
  surface: 'TOK_READ_ACTIVE_SOFT',
  textColor: 'TOK_READ_PRIMARY',
};
const CONTROL_COLLAPSE_INTER: ReaderPanelCollapseSpec = {
  labelWidth: 20,
  labelHeight: 12,
  textStyle: TYPE_READER_CONTROL_COLLAPSE_INTER,
  surface: 'TOK_READ_ACTIVE_SOFT',
  textColor: 'TOK_READ_PRIMARY',
};
const DIRECTORY_COLLAPSE: ReaderPanelCollapseSpec = {
  labelWidth: '100%',
  labelHeight: 14,
  textStyle: TYPE_READER_DIRECTORY_COLLAPSE,
  surface: 'TOK_SURFACE_PANEL_SOFT',
  textColor: 'TOK_READ_PRIMARY',
};

export function resolveReaderPanelCollapseSpec(id: ReaderPanelCollapseSpecId): ReaderPanelCollapseSpec {
  if (id === 'control-inter') return CONTROL_COLLAPSE_INTER;
  if (id === 'directory') return DIRECTORY_COLLAPSE;
  return CONTROL_COLLAPSE_UI;
}

export type ReaderQuickBackSpecId = 'search' | 'auto-page';

export interface ReaderQuickBackSpec {
  paddingLeft: number;
  paddingRight: number;
  surface: ReaderAppColorRole;
  textStyle: ReaderTextStyle;
  textColor: ReaderAppColorRole;
}

const SEARCH_QUICK_BACK: ReaderQuickBackSpec = {
  paddingLeft: 8,
  paddingRight: 0,
  surface: 'TOK_SURFACE_PANEL_SOFT',
  textStyle: TYPE_READER_SEARCH_RETAINED_QUICK_BACK_BACK,
  textColor: 'TOK_READ_PRIMARY',
};
const AUTO_PAGE_QUICK_BACK: ReaderQuickBackSpec = {
  paddingLeft: 9,
  paddingRight: 9,
  surface: 'TOK_SURFACE_PANEL',
  textStyle: TYPE_READER_AUTO_PAGE_RETAINED_QUICK_BACK_BACK,
  textColor: 'TOK_READ_PRIMARY',
};

export function resolveReaderQuickBackSpec(id: ReaderQuickBackSpecId): ReaderQuickBackSpec {
  return id === 'auto-page' ? AUTO_PAGE_QUICK_BACK : SEARCH_QUICK_BACK;
}

/** Shared 40×26 paint pill. Directory callers reserve a separate >=44 hit
 * carrier and font growth; other modules retain their original defaults. */
@Component
export struct ReaderPanelCollapseButton {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop specId: ReaderPanelCollapseSpecId = 'control-ui';
  @Prop label: string = '收起';
  @Prop accessibilityLabel: string = '收起';
  @Prop actionEnabled: boolean = true;
  @Prop componentId: string = '';
  @Prop minimumTarget: number = 0;
  @Prop fontScale: number = 1;
  onCollapse: () => void = (): void => {};

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Stack({ alignContent: Alignment.Center }) {
      Text(this.label)
        .width(typeof resolveReaderPanelCollapseSpec(this.specId).labelWidth === 'number' ?
          (resolveReaderPanelCollapseSpec(this.specId).labelWidth as number) * this.fontScale : '100%')
        .height(resolveReaderPanelCollapseSpec(this.specId).labelHeight * this.fontScale)
        .fontFamily(resolveReaderPanelCollapseSpec(this.specId).textStyle.fontFamily)
        .fontWeight(resolveReaderPanelCollapseSpec(this.specId).textStyle.fontWeight,
          { enableVariableFontWeight: true })
        .fontSize(resolveReaderPanelCollapseSpec(this.specId).textStyle.fontSizeFp)
        .lineHeight(resolveReaderPanelCollapseSpec(this.specId).textStyle.lineHeightFp as number)
        .minFontScale(1)
        .maxFontScale(this.fontScale)
        .fontColor(readerAppColor(resolveReaderPanelCollapseSpec(this.specId).textColor, this.appThemeScheme))
        .textAlign(TextAlign.Center);
      }.width(40 + 20 * (this.fontScale - 1)).height(26 + 14 * (this.fontScale - 1))
        .borderRadius(8)
        .backgroundColor(readerAppColor(resolveReaderPanelCollapseSpec(this.specId).surface, this.appThemeScheme))
        .attributeModifier(new ReaderPressFeedback(
          readerAppColor(resolveReaderPanelCollapseSpec(this.specId).surface, this.appThemeScheme),
          this.appThemeScheme, 8, 8, this.actionEnabled));
    }
    .width(Math.max(this.minimumTarget, 40 + 20 * (this.fontScale - 1)))
    .height(Math.max(this.minimumTarget, 26 + 14 * (this.fontScale - 1)))
    .id(this.componentId.length > 0 ? this.componentId : `reader-panel-collapse-${this.specId}`)
    .hitTestBehavior(HitTestMode.Block)
    .enabled(this.actionEnabled)
    .focusable(this.actionEnabled)
    .accessibilityRole(AccessibilityRoleType.BUTTON)
    .accessibilityText(this.accessibilityLabel)
    .onClick((): void => {
      if (this.actionEnabled) this.onCollapse();
    });
  }
}

/** Quick-panel back affordance shared by content search and auto-page. The
 * owning panel keeps its measured position, morph translation and opacity. */
@Component
export struct ReaderQuickBackButton {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop specId: ReaderQuickBackSpecId = 'search';
  @Prop frameWidth: number = 0;
  @Prop frameHeight: number = 0;
  @Prop actionEnabled: boolean = true;
  @Prop accessibilityLabel: string = '返回';
  onBack: () => void = (): void => {};

  build() {
    Row({ space: 4 }) {
      Image(this.appThemeScheme === 'night' ? $r('app.media.reader_quick_back_theme_night') : $r('app.media.reader_quick_back'))
        .width(11)
        .height(11);
      Text('返回')
        .fontFamily(resolveReaderQuickBackSpec(this.specId).textStyle.fontFamily)
        .fontWeight(resolveReaderQuickBackSpec(this.specId).textStyle.fontWeight)
        .fontSize(resolveReaderQuickBackSpec(this.specId).textStyle.fontSizeFp)
        .minFontScale(1)
        .maxFontScale(1)
        .fontColor(readerAppColor(resolveReaderQuickBackSpec(this.specId).textColor, this.appThemeScheme));
    }
    .width(this.frameWidth)
    .height(this.frameHeight)
    .padding({ left: resolveReaderQuickBackSpec(this.specId).paddingLeft,
      right: resolveReaderQuickBackSpec(this.specId).paddingRight })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor(resolveReaderQuickBackSpec(this.specId).surface, this.appThemeScheme))
    .borderRadius(8)
    .attributeModifier(new ReaderPressFeedback(
      readerAppColor(resolveReaderQuickBackSpec(this.specId).surface, this.appThemeScheme),
      this.appThemeScheme, 8, 8, this.actionEnabled))
    .enabled(this.actionEnabled)
    .focusable(this.actionEnabled)
    .accessibilityRole(AccessibilityRoleType.BUTTON)
    .accessibilityText(this.accessibilityLabel)
    .onClick((): void => {
      if (this.actionEnabled) this.onBack();
    });
  }
}
