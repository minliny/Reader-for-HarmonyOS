import { PopupSurfaceSpec, resolvePopupSpec, ActionSheetSurfaceSpec, resolveActionSheetSpec, type ActionSheetSpecId } from './ReaderSurfaceSpecs';
import { readerAppColor } from './ReaderThemeRegistry';

export type ReaderActionMenuVariant = 'menu' | ActionSheetSpecId;
export type ReaderActionTone = 'default' | 'danger';

export type ReaderActionMenuSpecId = 'bookshelf-more-menu' | 'reader-more-menu';

/** Business identity, content and admission. Geometry and disabled treatment
 * belong to the finite menu specification, not individual callers. */
export class ReaderMenuActionView {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly icon: Resource | undefined;
  readonly accessibilityLabel: string;
  readonly section: string;
  readonly secondary: string;
  readonly trailing: string;
  readonly tone: ReaderActionTone;
  readonly showChevron: boolean;
  constructor(
    id: string, label: string, enabled: boolean = true,
    icon: Resource | undefined = undefined, accessibilityLabel: string = label,
    section: string = '', secondary: string = '', trailing: string = '',
    tone: ReaderActionTone = 'default', showChevron: boolean = false,
  ) {
    this.id = id; this.label = label; this.enabled = enabled;
    this.icon = icon; this.accessibilityLabel = accessibilityLabel;
    this.section = section; this.secondary = secondary; this.trailing = trailing;
    this.tone = tone; this.showChevron = showChevron;
  }
}

/** One action renderer for anchored menus and action-sheet content. Platform
 * hosts keep their presentation lifecycle; finite registry variants own all
 * action layout and every physical callback reads live admission here. */
@Component
export struct ReaderActionMenuSurface {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop variant: ReaderActionMenuVariant = 'menu';
  @Prop specId: ReaderActionMenuSpecId = 'reader-more-menu';
  @Prop scheme: string = 'day';
  @Prop actions: ReaderMenuActionView[] = [];
  @Prop availableWidth: string | number = '100%';
  @Prop viewportHeight: number = 0;
  onAction: (id: string) => void = (): void => {};

  private mounted: boolean = false;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  build() {
    if (this.variant === 'menu') {
      this.menuActions();
    } else {
      this.actionRows();
    }
  }

  @Builder
  private menuActions() {
    Scroll() {
      Column() {
        ForEach(this.actions, (action: ReaderMenuActionView, index: number): void => {
          this.actionRow(action.id, index < this.actions.length - 1);
        }, (action: ReaderMenuActionView): string => action.id);
      }.width('100%').height(this.spec().actionHeight * this.actions.length);
    }.width(this.availableWidth)
      .height(Math.max(0, Math.min(this.spec().actionHeight * this.actions.length, this.viewportHeight)))
      .clip(true).scrollBar(BarState.Auto).align(Alignment.TopStart);
  }

  @Builder
  private actionRow(id: string, showDivider: boolean) {
    Stack({ alignContent: Alignment.TopStart }) {
      Row({ space: this.spec().actionIconSize > 0 ? 16 : 0 }) {
        if (this.action(id).icon !== undefined) {
          Image(this.action(id).icon)
            .width(this.spec().actionIconSize).height(this.spec().actionIconSize)
            .objectFit(ImageFit.Contain).accessibilityLevel('no')
            .opacity(this.action(id).enabled || !this.spec().actionMutesContent ? 1 : 0.45);
        }
        Text(this.action(id).label)
          .fontFamily(this.spec().actionFontFamily).fontWeight(this.spec().actionFontWeight)
          .fontSize(this.spec().actionFontSize).lineHeight(this.spec().actionLineHeight)
          .fontColor(readerAppColor(!this.action(id).enabled && this.spec().actionMutesContent ?
            'TOK_MUTED' : this.spec().actionTextRole, this.effectiveScheme()))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .layoutWeight(this.spec().actionIconSize > 0 ? 1 : undefined);
      }.width('100%').height(this.spec().actionHeight)
        .padding({ left: this.spec().actionPaddingLeft, right: this.spec().actionPaddingRight });
      if (showDivider) {
        Row().width(this.dividerWidth()).height(this.spec().dividerHeight)
          .backgroundColor(readerAppColor(this.spec().dividerRole, this.effectiveScheme()))
          .position({ x: this.spec().dividerInset, y: this.spec().actionHeight - this.spec().dividerHeight });
      }
    }.width('100%').height(this.spec().actionHeight)
      .backgroundColor(Color.Transparent)
      .opacity(this.action(id).enabled || this.spec().actionMutesContent ? 1 : 0.45)
      .enabled(this.action(id).enabled)
      .accessibilityText(this.action(id).accessibilityLabel)
      .onClick((): void => this.commitAction(id));
  }

  @Builder
  private actionRows() {
    Column({ space: 0 }) {
      ForEach(this.actions, (action: ReaderMenuActionView, index: number): void => {
        this.row(action.id, index);
      }, (action: ReaderMenuActionView): string => action.id);
    }.width('100%');
  }

  @Builder
  private row(id: string, index: number) {
    Column({ space: 0 }) {
      Row({ space: this.actionSheetSpec().rowGap }) {
        if (this.action(id).icon !== undefined) {
          Stack({ alignContent: Alignment.Center }) {
            Image(this.action(id).icon).width(this.actionSheetSpec().iconSize).height(this.actionSheetSpec().iconSize)
              .objectFit(ImageFit.Contain).accessibilityLevel('no');
          }.width(this.actionSheetSpec().iconContainer).height(this.actionSheetSpec().iconContainer)
            .backgroundColor(readerAppColor(this.action(id).tone === 'danger' ? 'TOK_DOWNLOAD_DANGER' : 'TOK_GREEN', this.effectiveScheme()))
            .borderRadius(this.actionSheetSpec().iconRadius);
        }
        Text(this.action(id).label).fontSize(this.actionSheetSpec().labelFontSize).lineHeight(this.actionSheetSpec().labelLineHeight)
          .fontFamily(this.actionSheetSpec().labelFontFamily).fontWeight(this.actionSheetSpec().labelFontWeight)
          .fontColor(this.color(this.action(id).tone === 'danger' ? 'danger' : 'ink'))
          .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis }).layoutWeight(1);
        if ((!this.action(id).enabled && this.action(id).secondary.length > 0) || this.action(id).trailing.length > 0) {
          Column({ space: 1 }) {
            if (!this.action(id).enabled && this.action(id).secondary.length > 0) {
              Text(this.action(id).secondary).fontSize(this.actionSheetSpec().secondaryFontSize).lineHeight(this.actionSheetSpec().secondaryLineHeight)
                .fontFamily(this.actionSheetSpec().regularFontFamily).fontWeight(this.actionSheetSpec().regularFontWeight)
                .fontColor(this.color('muted')).textAlign(TextAlign.End)
                .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
            }
            if (this.action(id).trailing.length > 0) {
              Text(this.action(id).trailing).fontSize(this.actionSheetSpec().trailingFontSize).lineHeight(this.actionSheetSpec().trailingLineHeight)
                .fontFamily(this.actionSheetSpec().regularFontFamily).fontWeight(this.actionSheetSpec().regularFontWeight)
                .fontColor(this.color('muted')).textAlign(TextAlign.End)
                .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
            }
          }.alignItems(HorizontalAlign.End).constraintSize({ maxWidth: '42%' }).flexShrink(1);
        }
        if (this.action(id).showChevron) {
          Image(this.effectiveScheme() === 'night' ? $r('app.media.reader_chevron_right_theme_night') : $r('app.media.reader_chevron_right'))
            .width(this.actionSheetSpec().chevronSize).height(this.actionSheetSpec().chevronSize);
        }
      }.width('100%').constraintSize({ minHeight: this.actionSheetSpec().rowHeight })
        .padding({ left: this.actionSheetSpec().rowInsetLeft, right: this.actionSheetSpec().rowInsetRight,
          top: this.actionSheetSpec().rowPaddingY, bottom: this.actionSheetSpec().rowPaddingY })
        .opacity(this.action(id).enabled ? 1 : 0.48).enabled(this.action(id).enabled)
        .accessibilityGroup(true).accessibilityText(this.accessibilityLabel(this.action(id))).onClick((): void => this.commitAction(id));
      if (index < this.actions.length - 1) {
        Row().width(`calc(100% - ${this.actionSheetSpec().dividerInset}vp)`).height(this.actionSheetSpec().dividerHeight)
          .backgroundColor(readerAppColor('TOK_ROW_DIVIDER', this.effectiveScheme()))
          .margin({ left: this.actionSheetSpec().dividerInset });
      }
    }.width('100%');
  }

  private actionSheetSpec(): ActionSheetSurfaceSpec {
    return resolveActionSheetSpec(this.variant === 'bookshelf' ? 'bookshelf' : this.variant === 'quick' ? 'quick' : 'grouped');
  }

  private spec(): PopupSurfaceSpec { return resolvePopupSpec(this.specId); }

  private action(id: string): ReaderMenuActionView {
    return this.actions.find((action: ReaderMenuActionView): boolean => action.id === id) ??
      new ReaderMenuActionView(id, '', false);
  }

  private dividerWidth(): string | number {
    return typeof this.availableWidth === 'number' ?
      Math.max(0, this.availableWidth - this.spec().dividerInset * 2) :
      `calc(100% - ${this.spec().dividerInset * 2}vp)`;
  }

  private effectiveScheme(): string { return this.scheme === 'auto' ? this.appThemeScheme : this.scheme; }

  private color(role: 'ink' | 'muted' | 'danger'): string {
    const spec = this.actionSheetSpec();
    return readerAppColor(role === 'ink' ? spec.inkRole : role === 'muted' ? spec.mutedRole : spec.dangerRole,
      this.effectiveScheme());
  }

  private accessibilityLabel(action: ReaderMenuActionView): string {
    const state = action.enabled ? '' : '，当前不可用';
    const detail = action.secondary.length > 0 ? `，${action.secondary}` : '';
    const trailing = action.trailing.length > 0 ? `，${action.trailing}` : '';
    return `${action.label}${detail}${trailing}${state}`;
  }

  private commitAction(id: string): void {
    if (this.mounted && this.action(id).enabled) this.onAction(id);
  }
}
