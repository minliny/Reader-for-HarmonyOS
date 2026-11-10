import type { ReaderAppColorRole } from '../foundation/ReaderThemeRegistry';
import {
  ReaderTextStyle, TYPE_SELECT_DEFAULT_VALUE, TYPE_SELECT_OPTION,
  TYPE_SELECT_SOURCE_GROUP_VALUE,
  TYPE_SETTINGS_SELECT_PHONE_OPTION, TYPE_SETTINGS_SELECT_TABLET_OPTION,
  TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_REGULAR, TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_SELECTED, TYPE_DOWNLOAD_BODY,
} from '../foundation/ReaderTypography';

import { readerReadableFontScale, readerScaledControlHeight } from '../foundation/ReaderSurfaceResolvers';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { ReaderActionAccessibility } from './ReaderActionAccessibility';

type ReaderChoiceSpecId = 'settings-phone' | 'settings-tablet' | 'appearance-library' |
  'default-selected' | 'source-group-selected' | 'default-option' | 'source-group-option' | 'download-radio';
type ReaderChoiceLayout = 'row' | 'positioned';

interface ReaderChoiceSpec {
  height: number;
  padding: number;
  gap: number;
  radius: number;
  text: ReaderTextStyle;
  selectedText: ReaderTextStyle;
  selectedWeight: number;
  variableWeight: boolean;
  textRole: ReaderAppColorRole;
  selectedTextRole: ReaderAppColorRole;
  selectedBackground: ReaderAppColorRole | undefined;
  dividerRole: ReaderAppColorRole | undefined;
  dividerHeight: number;
  iconDay: string;
  iconNight: string;
  iconWidth: number;
  iconHeight: number;
  showIcon: 'always' | 'selected' | 'never';
  rotateIcon: boolean;
  layout: ReaderChoiceLayout;
  textLeft: number;
  iconRight: number;
  ellipsis: boolean;
  textAlignStart: boolean;
}

const COMMON_ROW: ReaderChoiceSpec = {
  height: 44, padding: 10, gap: 0, radius: 0,
  text: TYPE_SELECT_OPTION, selectedText: TYPE_SELECT_OPTION,
  selectedWeight: TYPE_SELECT_OPTION.fontWeight, variableWeight: false,
  textRole: 'TOK_CONTROL_INK', selectedTextRole: 'TOK_CONTROL_INK',
  selectedBackground: undefined, dividerRole: undefined, dividerHeight: 0,
  iconDay: '', iconNight: '', iconWidth: 0, iconHeight: 0, showIcon: 'never', rotateIcon: false,
  layout: 'row', textLeft: 0, iconRight: 0,
  ellipsis: true, textAlignStart: true,
};

// A finite registry preserves every current geometry/typography tuple. It is
// not an arbitrary style bag exposed to page callers.
function copyReaderChoiceSpec(): ReaderChoiceSpec {
  return {
    height: COMMON_ROW.height,
    padding: COMMON_ROW.padding,
    gap: COMMON_ROW.gap,
    radius: COMMON_ROW.radius,
    text: COMMON_ROW.text,
    selectedText: COMMON_ROW.selectedText,
    selectedWeight: COMMON_ROW.selectedWeight,
    variableWeight: COMMON_ROW.variableWeight,
    textRole: COMMON_ROW.textRole,
    selectedTextRole: COMMON_ROW.selectedTextRole,
    selectedBackground: COMMON_ROW.selectedBackground,
    dividerRole: COMMON_ROW.dividerRole,
    dividerHeight: COMMON_ROW.dividerHeight,
    iconDay: COMMON_ROW.iconDay,
    iconNight: COMMON_ROW.iconNight,
    iconWidth: COMMON_ROW.iconWidth,
    iconHeight: COMMON_ROW.iconHeight,
    showIcon: COMMON_ROW.showIcon,
    rotateIcon: COMMON_ROW.rotateIcon,
    layout: COMMON_ROW.layout,
    textLeft: COMMON_ROW.textLeft,
    iconRight: COMMON_ROW.iconRight,
    ellipsis: COMMON_ROW.ellipsis,
    textAlignStart: COMMON_ROW.textAlignStart,
  };
}
const CHOICE_SOURCE_GROUP_OPTION: ReaderChoiceSpec = copyReaderChoiceSpec();
CHOICE_SOURCE_GROUP_OPTION.padding = 14;
CHOICE_SOURCE_GROUP_OPTION.text = TYPE_SELECT_SOURCE_GROUP_VALUE;
CHOICE_SOURCE_GROUP_OPTION.selectedText = TYPE_SELECT_SOURCE_GROUP_VALUE;
CHOICE_SOURCE_GROUP_OPTION.textRole = 'TOK_INK';
CHOICE_SOURCE_GROUP_OPTION.selectedTextRole = 'TOK_INK';
const CHOICE_DEFAULT_SELECTED: ReaderChoiceSpec = copyReaderChoiceSpec();
CHOICE_DEFAULT_SELECTED.gap = 8;
CHOICE_DEFAULT_SELECTED.text = TYPE_SELECT_DEFAULT_VALUE;
CHOICE_DEFAULT_SELECTED.selectedText = TYPE_SELECT_DEFAULT_VALUE;
CHOICE_DEFAULT_SELECTED.selectedWeight = TYPE_SELECT_DEFAULT_VALUE.fontWeight;
CHOICE_DEFAULT_SELECTED.textRole = 'TOK_PRIMARY_TEXT';
CHOICE_DEFAULT_SELECTED.selectedTextRole = 'TOK_PRIMARY_TEXT';
CHOICE_DEFAULT_SELECTED.selectedBackground = 'app.select.selectedSurface';
CHOICE_DEFAULT_SELECTED.iconDay = 'app.media.reader_chevron_down';
CHOICE_DEFAULT_SELECTED.iconNight = 'app.media.reader_chevron_down_theme_night';
CHOICE_DEFAULT_SELECTED.iconWidth = 12;
CHOICE_DEFAULT_SELECTED.iconHeight = 8;
CHOICE_DEFAULT_SELECTED.showIcon = 'always';
CHOICE_DEFAULT_SELECTED.rotateIcon = true;
const CHOICE_SOURCE_GROUP_SELECTED: ReaderChoiceSpec = copyReaderChoiceSpec();
CHOICE_SOURCE_GROUP_SELECTED.text = TYPE_SELECT_SOURCE_GROUP_VALUE;
CHOICE_SOURCE_GROUP_SELECTED.selectedText = TYPE_SELECT_SOURCE_GROUP_VALUE;
CHOICE_SOURCE_GROUP_SELECTED.selectedWeight = TYPE_SELECT_SOURCE_GROUP_VALUE.fontWeight;
CHOICE_SOURCE_GROUP_SELECTED.textRole = 'TOK_INK';
CHOICE_SOURCE_GROUP_SELECTED.selectedTextRole = 'TOK_INK';
CHOICE_SOURCE_GROUP_SELECTED.selectedBackground = 'app.select.sourceGroupSelected';
CHOICE_SOURCE_GROUP_SELECTED.iconDay = 'app.media.source_group_chevron';
CHOICE_SOURCE_GROUP_SELECTED.iconNight = 'app.media.source_group_chevron_theme_night';
CHOICE_SOURCE_GROUP_SELECTED.iconWidth = 12;
CHOICE_SOURCE_GROUP_SELECTED.iconHeight = 12;
CHOICE_SOURCE_GROUP_SELECTED.showIcon = 'always';
CHOICE_SOURCE_GROUP_SELECTED.rotateIcon = true;
CHOICE_SOURCE_GROUP_SELECTED.layout = 'positioned';
CHOICE_SOURCE_GROUP_SELECTED.textLeft = 14;
CHOICE_SOURCE_GROUP_SELECTED.iconRight = 21;
const CHOICE_APPEARANCE_LIBRARY: ReaderChoiceSpec = copyReaderChoiceSpec();
CHOICE_APPEARANCE_LIBRARY.height = 44;
CHOICE_APPEARANCE_LIBRARY.padding = 9;
CHOICE_APPEARANCE_LIBRARY.gap = 10;
CHOICE_APPEARANCE_LIBRARY.radius = 6;
CHOICE_APPEARANCE_LIBRARY.text = TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_REGULAR;
CHOICE_APPEARANCE_LIBRARY.selectedText = TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_SELECTED;
CHOICE_APPEARANCE_LIBRARY.selectedWeight = 700;
CHOICE_APPEARANCE_LIBRARY.variableWeight = true;
CHOICE_APPEARANCE_LIBRARY.textAlignStart = false;
CHOICE_APPEARANCE_LIBRARY.textRole = 'TOK_CONTROL_INK';
CHOICE_APPEARANCE_LIBRARY.selectedTextRole = 'TOK_READ_PRIMARY';
CHOICE_APPEARANCE_LIBRARY.selectedBackground = 'app.appearance.selectSelected';
CHOICE_APPEARANCE_LIBRARY.iconDay = 'app.media.reader_appearance_make_check';
CHOICE_APPEARANCE_LIBRARY.iconNight = 'app.media.reader_appearance_make_check_theme_night';
CHOICE_APPEARANCE_LIBRARY.iconWidth = 11;
CHOICE_APPEARANCE_LIBRARY.iconHeight = 9;
CHOICE_APPEARANCE_LIBRARY.showIcon = 'selected';
const CHOICE_SETTINGS_PHONE: ReaderChoiceSpec = copyReaderChoiceSpec();
CHOICE_SETTINGS_PHONE.height = 52;
CHOICE_SETTINGS_PHONE.padding = 16;
CHOICE_SETTINGS_PHONE.text = TYPE_SETTINGS_SELECT_PHONE_OPTION;
CHOICE_SETTINGS_PHONE.selectedText = TYPE_SETTINGS_SELECT_PHONE_OPTION;
CHOICE_SETTINGS_PHONE.selectedWeight = 700;
CHOICE_SETTINGS_PHONE.ellipsis = false;
CHOICE_SETTINGS_PHONE.textAlignStart = false;
CHOICE_SETTINGS_PHONE.textRole = 'app.text.heading';
CHOICE_SETTINGS_PHONE.selectedTextRole = 'TOK_GREEN';
CHOICE_SETTINGS_PHONE.selectedBackground = 'app.selection.optionSoft';
CHOICE_SETTINGS_PHONE.dividerRole = 'app.border.control';
CHOICE_SETTINGS_PHONE.dividerHeight = 1;
CHOICE_SETTINGS_PHONE.iconDay = 'app.media.settings_select_check';
CHOICE_SETTINGS_PHONE.iconNight = 'app.media.settings_select_check_theme_night';
CHOICE_SETTINGS_PHONE.iconWidth = 16;
CHOICE_SETTINGS_PHONE.iconHeight = 16;
CHOICE_SETTINGS_PHONE.showIcon = 'selected';
const CHOICE_SETTINGS_TABLET: ReaderChoiceSpec = copyReaderChoiceSpec();
CHOICE_SETTINGS_TABLET.height = 44;
CHOICE_SETTINGS_TABLET.padding = 14;
CHOICE_SETTINGS_TABLET.text = TYPE_SETTINGS_SELECT_TABLET_OPTION;
CHOICE_SETTINGS_TABLET.selectedText = TYPE_SETTINGS_SELECT_TABLET_OPTION;
CHOICE_SETTINGS_TABLET.selectedWeight = 700;
CHOICE_SETTINGS_TABLET.ellipsis = false;
CHOICE_SETTINGS_TABLET.textAlignStart = false;
CHOICE_SETTINGS_TABLET.textRole = 'app.text.heading';
CHOICE_SETTINGS_TABLET.selectedTextRole = 'TOK_GREEN';
CHOICE_SETTINGS_TABLET.selectedBackground = 'app.selection.subtle';
CHOICE_SETTINGS_TABLET.dividerRole = 'app.border.control';
CHOICE_SETTINGS_TABLET.dividerHeight = 1;
CHOICE_SETTINGS_TABLET.iconDay = 'app.media.settings_select_check';
CHOICE_SETTINGS_TABLET.iconNight = 'app.media.settings_select_check_theme_night';
CHOICE_SETTINGS_TABLET.iconWidth = 14;
CHOICE_SETTINGS_TABLET.iconHeight = 14;
CHOICE_SETTINGS_TABLET.showIcon = 'selected';

const CHOICE_DOWNLOAD_RADIO: ReaderChoiceSpec = copyReaderChoiceSpec();
CHOICE_DOWNLOAD_RADIO.height = 45;
CHOICE_DOWNLOAD_RADIO.gap = 10;
CHOICE_DOWNLOAD_RADIO.padding = 8;
CHOICE_DOWNLOAD_RADIO.iconWidth = 13;
CHOICE_DOWNLOAD_RADIO.iconHeight = 13;
CHOICE_DOWNLOAD_RADIO.dividerHeight = 1;

const CHOICES: Record<ReaderChoiceSpecId, ReaderChoiceSpec> = {
  'default-option': COMMON_ROW,
  'source-group-option': CHOICE_SOURCE_GROUP_OPTION,
  'default-selected': CHOICE_DEFAULT_SELECTED,
  'source-group-selected': CHOICE_SOURCE_GROUP_SELECTED,
  'appearance-library': CHOICE_APPEARANCE_LIBRARY,
  'settings-phone': CHOICE_SETTINGS_PHONE,
  'settings-tablet': CHOICE_SETTINGS_TABLET,
  'download-radio': CHOICE_DOWNLOAD_RADIO,
};

function resolveReaderChoiceSpec(id: ReaderChoiceSpecId): ReaderChoiceSpec { return CHOICES[id]; }

/** The finite row spec keeps AUTO attributes absent, rather than calling a
 * native setter with undefined (which has different platform semantics). */
class ReaderChoiceLabelModifier implements AttributeModifier<TextAttribute> {
  private id: ReaderChoiceSpecId;
  private selected: boolean;
  private multiline: boolean;
  constructor(id: ReaderChoiceSpecId, selected: boolean, multiline: boolean = false) {
    this.id = id;
    this.selected = selected;
    this.multiline = multiline;
  }
  applyNormalAttribute(instance: TextAttribute): void {
    const spec = resolveReaderChoiceSpec(this.id);
    const text = this.selected ? spec.selectedText : spec.text;
    instance.fontFamily(text.fontFamily);
    const weight = this.selected ? spec.selectedWeight : text.fontWeight;
    if (spec.variableWeight) instance.fontWeight(weight, { enableVariableFontWeight: true });
    else instance.fontWeight(weight);
    instance.fontSize(text.fontSizeFp);
    if (text.lineHeightFp !== undefined) instance.lineHeight(text.lineHeightFp);
    if (spec.textAlignStart) instance.textAlign(TextAlign.Start);
    if (this.multiline) instance.wordBreak(WordBreak.BREAK_WORD);
    else if (spec.ellipsis) instance.textOverflow({ overflow: TextOverflow.Ellipsis });
  }
}

/** Controlled option row shared by inline selectors and responsive Settings.
 * Caller owns choice identity/commit; the finite spec owns the whole row. */
@Component
export struct ReaderChoiceRow {
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop specId: ReaderChoiceSpecId = 'default-option';
  @Prop optionId: string = '';
  @Prop groupId: string = '';
  @Prop label: string = '';
  @Prop selected: boolean = false;
  @Prop showDivider: boolean = false;
  @Prop scheme: string = 'day';
  @Prop chevronAngle: number = 0;
  @Prop actionEnabled: boolean = true;
  @Prop wrapLabel: boolean = false;
  /** Optional focus address on the wrapping option row. */
  @Prop focusId: string = '';
  onHeightChange: (height: number) => void = (_height: number): void => {};
  onChoose: (value: string) => void = (): void => {};

  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  build() {
    if (this.specId === 'download-radio') {
      this.radioRow();
    } else if (this.wrapLabel || this.specId === 'source-group-selected') {
      this.flowRow();
    } else {
    Column() {
      this.normalRow();
      if (this.showDivider && this.spec().dividerRole !== undefined) {
        Row() {
          Blank().layoutWeight(1).height(this.spec().dividerHeight)
            .backgroundColor(readerAppColor(this.spec().dividerRole!, this.scheme));
        }.width('100%').height(this.spec().dividerHeight)
          .padding({ left: this.spec().padding, right: this.spec().padding });
      }
    }.width('100%').height(this.outerHeight());
    }
  }

  @Builder
  private radioRow() {
    Button({ type: ButtonType.Normal }) {
      Row({ space: this.spec().gap }) {
        // The native ring is visual only. The whole row owns activation.
        Radio({ value: this.optionId, group: this.groupId }).checked(this.selected)
          .width(this.spec().iconWidth).height(this.spec().iconHeight).padding(0)
          .radioStyle({ checkedBackgroundColor: readerAppColor('TOK_DOWNLOAD_GREEN', this.scheme),
            uncheckedBorderColor: readerAppColor('TOK_DOWNLOAD_MUTED', this.scheme),
            indicatorColor: readerAppColor('TOK_DOWNLOAD_SURFACE', this.scheme) })
          .focusable(false).hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
        Text(this.label).layoutWeight(1).fontFamily(TYPE_DOWNLOAD_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_BODY.fontWeight)
          .fontSize(TYPE_DOWNLOAD_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BODY.lineHeightFp as number).halfLeading(true)
          .fontColor(readerAppColor('TOK_DOWNLOAD_INK', this.scheme));
      }.width('100%');
    }.constraintSize({ minHeight: this.spec().height }).width('100%')
      .padding({ left: 0, right: 0, top: this.spec().padding, bottom: this.spec().padding }).borderRadius(0)
      .backgroundColor(Color.Transparent).enabled(this.actionEnabled).id(this.focusId)
      .border({ width: { bottom: this.spec().dividerHeight }, color: readerAppColor('TOK_DOWNLOAD_LINE', this.scheme) })
      .accessibilityRole(AccessibilityRoleType.RADIO).accessibilitySelected(this.selected).accessibilityText(this.label)
      .onClick((): void => this.choose());
  }

  @Builder
  private flowRow() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: this.spec().layout === 'positioned' ? 7 : this.spec().gap }) {
        Text(this.label).layoutWeight(1)
          .attributeModifier(new ReaderChoiceLabelModifier(this.specId, this.selected, true))
          .fontColor(this.textColor());
        if (this.hasIcon()) {
          Image(this.icon()).width(this.spec().iconWidth).height(this.spec().iconHeight).flexShrink(0)
            .rotate({ angle: this.spec().rotateIcon ? this.chevronAngle : 0 });
        }
      }.width('100%').alignItems(VerticalAlign.Center)
        .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }.width('100%').constraintSize({ minHeight: this.specId === 'default-selected' || this.specId === 'default-option' ? 44 : this.spec().height })
      .padding({ left: this.spec().layout === 'positioned' ? this.spec().textLeft : this.spec().padding,
        right: this.spec().layout === 'positioned' ? this.spec().iconRight - this.spec().iconWidth : this.spec().padding,
        top: this.specId === 'appearance-library' ? 6 : 10, bottom: this.specId === 'appearance-library' ? 6 : 10 })
      .borderRadius(this.spec().radius).flexShrink(0)
      .backgroundColor(this.rowBackground()).enabled(this.actionEnabled)
      .id(this.focusId)
      .accessibilitySelected(this.selected)
      .attributeModifier(new ReaderActionAccessibility(this.accessibilityLabel(), this.actionEnabled, this.selected, this.focusId.length > 0, undefined, 'nativeButton'))
      .accessibilityText(this.accessibilityLabel()).onClick((): void => this.choose())
      .onAreaChange((_old: Area, next: Area): void => {
        const height = typeof next.height === 'number' ? next.height : Number.parseFloat(next.height as string);
        if (Number.isFinite(height) && height > 0) this.onHeightChange(height);
      });
  }

  @Builder
  private normalRow() {
    if (this.specId === 'settings-phone') {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Row({ space: this.spec().gap }) { this.normalRowContent(); }
          .width('100%').alignItems(VerticalAlign.Center)
          .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
      }.width('100%').height(this.rowHeight())
        .padding({ left: this.spec().padding, right: this.spec().padding, top: 0, bottom: 0 })
        .borderRadius(this.spec().radius).backgroundColor(this.rowBackground())
        .enabled(this.actionEnabled).id(this.focusId)
        .accessibilityRole(AccessibilityRoleType.BUTTON).accessibilitySelected(this.selected)
        .accessibilityText(this.accessibilityLabel()).onClick((): void => this.choose());
    } else {
      // Tablet-only and retained nonwrapping compatibility callers keep their
      // existing carrier; current phone menus use the native branches above.
      Row({ space: this.spec().gap }) { this.normalRowContent(); }
        .width('100%').height(this.rowHeight())
        .padding({ left: this.spec().padding, right: this.spec().padding })
        .alignItems(VerticalAlign.Center).borderRadius(this.spec().radius)
        .backgroundColor(this.rowBackground())
        .enabled(this.actionEnabled).accessibilityText(this.accessibilityLabel())
        .onClick((): void => this.choose());
    }
  }

  @Builder
  private normalRowContent() {
    Text(this.label).layoutWeight(1)
      .attributeModifier(new ReaderChoiceLabelModifier(this.specId, this.selected))
      .fontColor(this.textColor()).maxLines(1);
    if (this.hasIcon()) {
      Image(this.icon()).width(this.spec().iconWidth).height(this.spec().iconHeight)
        .rotate({ angle: this.spec().rotateIcon ? this.chevronAngle : 0 });
    }
  }

  private spec(): ReaderChoiceSpec { return resolveReaderChoiceSpec(this.specId); }
  private rowHeight(): number {
    const divider = this.showDivider ? this.spec().dividerHeight : 0;
    return readerScaledControlHeight(this.spec().height - divider,
      this.spec().text.lineHeightFp ?? this.spec().text.fontSizeFp * 1.5, this.fontScale());
  }
  private outerHeight(): number {
    return this.rowHeight() + (this.showDivider ? this.spec().dividerHeight : 0);
  }
  private fontScale(): number {
    if (this.readerWindowMetricsRevision < 0) return 1;
    return readerReadableFontScale(readerWindowMetrics().systemFontScale);
  }
  private textColor(): ResourceColor { return readerAppColor(this.selected ? this.spec().selectedTextRole : this.spec().textRole, this.scheme); }
  private rowBackground(): ResourceColor {
    return this.selected && this.spec().selectedBackground !== undefined ?
      readerAppColor(this.spec().selectedBackground!, this.scheme) : Color.Transparent;
  }
  private hasIcon(): boolean { return this.spec().showIcon === 'always' || (this.spec().showIcon === 'selected' && this.selected); }
  private icon(): Resource { return $r(this.scheme === 'night' ? this.spec().iconNight : this.spec().iconDay); }
  private accessibilityLabel(): string { return this.specId === 'appearance-library' ? `${this.label}${this.selected ? '，已选择' : ''}` : this.label; }
  private choose(): void { if (this.mounted && this.actionEnabled) this.onChoose(this.optionId || this.label); }
}
