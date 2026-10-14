import { ActionSheetSurfaceSpec, resolveActionSheetSpec, type ActionSheetSpecId } from './ReaderSurfaceSpecs';
import { readerAppColor } from './ReaderThemeRegistry';

export type ReaderActionSheetVariant = ActionSheetSpecId;
export type ReaderActionSheetTone = 'default' | 'danger';

/**
 * A content-only action sheet. The host owns the sheet frame, scrim, close
 * lifecycle and back handling; this component owns the shared action hierarchy
 * used by bottom sheets across Reader.
 */
export class ReaderActionSheetAction {
  readonly id: string;
  readonly label: string;
  readonly section: string;
  readonly secondary: string;
  readonly trailing: string;
  readonly enabled: boolean;
  readonly icon: Resource | undefined;
  readonly tone: ReaderActionSheetTone;
  readonly showChevron: boolean;

  constructor(
    id: string,
    label: string,
    section: string = '',
    secondary: string = '',
    trailing: string = '',
    enabled: boolean = true,
    icon: Resource | undefined = undefined,
    tone: ReaderActionSheetTone = 'default',
    showChevron: boolean = false,
  ) {
    this.id = id;
    this.label = label;
    this.section = section;
    this.secondary = secondary;
    this.trailing = trailing;
    this.enabled = enabled;
    this.icon = icon;
    this.tone = tone;
    this.showChevron = showChevron;
  }
}

@Component
export struct ReaderActionSheetContent {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop variant: ReaderActionSheetVariant = 'grouped';
  @Prop actions: ReaderActionSheetAction[] = [];
  @Prop scheme: 'auto' | 'day' | 'night' = 'auto';
  onAction: (id: string) => void = (_id: string): void => {};
  private mounted: boolean = false;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  build() {
    Column({ space: 0 }) {
      if (this.variant === 'quick') {
        this.quickActions();
      } else {
        this.groupedActions();
      }
    }.width('100%');
  }

  @Builder
  private groupedActions() {
    Column({ space: 0 }) {
      ForEach(this.sectionIds(0), (id: string): void => {
        this.actionGroup(id, 0);
      }, (id: string): string => id);
    }.width('100%');
  }

  @Builder
  private quickActions() {
    Column({ space: 0 }) {
      Row({ space: this.spec().quickActionGap }) {
        ForEach(this.actions, (action: ReaderActionSheetAction, index: number): void => {
          if (index < this.spec().quickActionCount) this.quickAction(action.id);
        }, (action: ReaderActionSheetAction, index: number): string => `quick:${index}:${action.id}`);
      }.width('100%').constraintSize({ minHeight: this.spec().quickActionHeight });

      if (this.actions.length > this.spec().quickActionCount) {
        Row().width('100%').height(this.spec().dividerHeight).backgroundColor(this.color('line'))
          .margin({ top: this.spec().quickSeparatorTop, bottom: this.spec().quickSeparatorBottom });
        Column({ space: 0 }) {
          ForEach(this.sectionIds(this.spec().quickActionCount), (id: string): void => {
            this.actionGroup(id, this.spec().quickActionCount);
          }, (id: string): string => `list:${id}`);
        }.width('100%');
      }
    }.width('100%');
  }

  @Builder
  private actionGroup(id: string, first: number) {
    Column({ space: 0 }) {
      this.sectionHeading(id);
      Column({ space: 0 }) {
        ForEach(this.groupActions(id, first), (item: ReaderActionSheetAction): void => {
          this.row(item.id, this.actionIndex(item.id));
        }, (item: ReaderActionSheetAction): string => item.id);
      }.width('100%').backgroundColor(this.color('group')).borderRadius(this.spec().groupRadius);
    }.width('100%').margin({ bottom: this.spec().groupGap });
  }

  @Builder
  private sectionHeading(id: string) {
    if (this.action(id).section.length > 0) {
      Text(this.action(id).section).fontSize(this.spec().sectionHeadingFontSize).lineHeight(this.spec().sectionHeadingLineHeight)
        .fontFamily(this.spec().emphasisFontFamily).fontWeight(this.spec().emphasisFontWeight)
        .fontColor(this.color('muted')).width('100%').constraintSize({ minHeight: this.spec().sectionHeadingHeight }).padding({ top: 4, bottom: 4 });
    }
  }

  @Builder
  private quickAction(id: string) {
    Column({ space: this.spec().quickActionGap + 2 }) {
      if (this.action(id).icon !== undefined) {
        Stack() {
          Image(this.action(id).icon).width(this.spec().iconSize).height(this.spec().iconSize);
        }.width(this.spec().quickIconContainer).height(this.spec().quickIconContainer)
          .backgroundColor(this.color('group')).borderRadius(this.spec().groupRadius);
      }
      Text(this.action(id).label).fontSize(this.spec().quickLabelFontSize).lineHeight(this.spec().quickLabelLineHeight)
        .fontFamily(this.spec().emphasisFontFamily).fontWeight(this.spec().emphasisFontWeight)
        .fontColor(this.color(this.action(id).tone === 'danger' ? 'danger' : 'ink'))
        .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
      if (this.action(id).secondary.length > 0) {
        Text(this.action(id).secondary).fontSize(this.spec().quickSecondaryFontSize).lineHeight(this.spec().quickSecondaryLineHeight)
          .fontFamily(this.spec().regularFontFamily).fontWeight(this.spec().regularFontWeight)
          .fontColor(this.color('muted')).maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
      }
    }.layoutWeight(1).constraintSize({ minHeight: this.spec().quickActionHeight }).padding({ top: 12, bottom: 12 })
      .justifyContent(FlexAlign.Center).opacity(this.action(id).enabled ? 1 : 0.48).enabled(this.action(id).enabled)
      .accessibilityGroup(true).accessibilityText(this.accessibilityLabel(this.action(id))).onClick((): void => this.commit(id));
  }

  @Builder
  private row(id: string, index: number) {
    Column({ space: 0 }) {
      Row({ space: this.spec().rowGap }) {
        if (this.action(id).icon !== undefined) {
          Image(this.action(id).icon).width(this.spec().iconSize).height(this.spec().iconSize);
        }
        Column({ space: 1 }) {
          Text(this.action(id).label).fontSize(this.spec().labelFontSize).lineHeight(this.spec().labelLineHeight)
            .fontFamily(this.action(id).tone === 'danger' ? this.spec().emphasisFontFamily : this.spec().regularFontFamily)
            .fontWeight(this.action(id).tone === 'danger' ? this.spec().emphasisFontWeight : this.spec().regularFontWeight)
            .fontColor(this.color(this.action(id).tone === 'danger' ? 'danger' : 'ink'))
            .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
          if (this.action(id).secondary.length > 0) {
            Text(this.action(id).secondary).fontSize(this.spec().secondaryFontSize).lineHeight(this.spec().secondaryLineHeight)
              .fontFamily(this.spec().regularFontFamily).fontWeight(this.spec().regularFontWeight)
              .fontColor(this.color('muted')).maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
          }
        }.layoutWeight(1).alignItems(HorizontalAlign.Start);
        if (this.action(id).trailing.length > 0) {
          Text(this.action(id).trailing).fontSize(this.spec().trailingFontSize).lineHeight(this.spec().trailingLineHeight)
            .fontFamily(this.spec().regularFontFamily).fontWeight(this.spec().regularFontWeight)
            .fontColor(this.color('muted')).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        if (this.action(id).showChevron) {
          Image(this.effectiveScheme() === 'night' ? $r('app.media.reader_chevron_right_theme_night') : $r('app.media.reader_chevron_right'))
            .width(this.spec().chevronSize).height(this.spec().chevronSize);
        }
      }.width('100%').constraintSize({ minHeight: this.action(id).secondary.length > 0 ? this.spec().rowSecondaryHeight : this.spec().rowHeight })
        .padding({ left: this.spec().rowInsetLeft, right: this.spec().rowInsetRight, top: 10, bottom: 10 })
        .opacity(this.action(id).enabled ? 1 : 0.48).enabled(this.action(id).enabled)
        .accessibilityGroup(true).accessibilityText(this.accessibilityLabel(this.action(id))).onClick((): void => this.commit(id));
      if (index < this.actions.length - 1 && !this.startsSection(index + 1)) {
        Row().width(`calc(100% - ${this.spec().dividerInset}vp)`).height(this.spec().dividerHeight).backgroundColor(this.color('line'))
          .opacity(0.45).margin({ left: this.spec().dividerInset });
      }
    }.width('100%');
  }

  private startsSection(index: number): boolean {
    if (index < 0 || index >= this.actions.length) return false;
    return index === 0 || this.actions[index].section !== this.actions[index - 1].section;
  }

  private actionIndex(id: string): number {
    return this.actions.findIndex((item: ReaderActionSheetAction): boolean => item.id === id);
  }

  private sectionIds(first: number): string[] {
    return this.actions.filter((_item: ReaderActionSheetAction, index: number): boolean =>
      index >= first && (index === first || this.startsSection(index)))
      .map((item: ReaderActionSheetAction): string => item.id);
  }

  private groupActions(id: string, first: number): ReaderActionSheetAction[] {
    const start = Math.max(first, this.actionIndex(id));
    let end = start + 1;
    while (end < this.actions.length && !this.startsSection(end)) end++;
    return this.actions.slice(start, end);
  }

  private spec(): ActionSheetSurfaceSpec {
    return resolveActionSheetSpec(this.variant);
  }

  private action(id: string): ReaderActionSheetAction {
    return this.actions.find((item: ReaderActionSheetAction): boolean => item.id === id) ?? new ReaderActionSheetAction(id, '', '', '', '', false);
  }

  private effectiveScheme(): string { return this.scheme === 'auto' ? this.appThemeScheme : this.scheme; }

  private color(role: 'ink' | 'muted' | 'danger' | 'line' | 'group'): string {
    const spec = this.spec();
    return readerAppColor(role === 'ink' ? spec.inkRole : role === 'muted' ? spec.mutedRole : role === 'danger' ? spec.dangerRole : role === 'group' ? spec.groupRole : spec.lineRole,
      this.effectiveScheme());
  }

  private accessibilityLabel(action: ReaderActionSheetAction): string {
    const state = action.enabled ? '' : '，当前不可用';
    const detail = action.secondary.length > 0 ? `，${action.secondary}` : '';
    const trailing = action.trailing.length > 0 ? `，${action.trailing}` : '';
    return `${action.label}${detail}${trailing}${state}`;
  }

  private commit(id: string): void {
    if (this.mounted && this.action(id).enabled) this.onAction(id);
  }
}
