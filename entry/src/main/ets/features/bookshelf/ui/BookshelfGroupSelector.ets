import { TYPE_APP_FILTER_OPTION, TYPE_APP_INHERITED_BODY } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { LengthMetrics } from '@kit.ArkUI';
import type { BookGroup } from '../application/BookshelfManagementGateway';

/** V1 lightweight single-select group control; never mutates groups on open. */
@Component
export struct BookshelfGroupSelector {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;

  @Prop selectedGroup: string = '';
  @Prop groups: BookGroup[] = [];
  @Prop busy: boolean = false;
  @Prop defaultOptionId: string = '';
  onSelect: (group: string) => void = (_group: string): void => {};

  build() {
    Column({ space: 8 }) {
      Row() {
        Text('分组').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .fontFamily(TYPE_APP_INHERITED_BODY.fontFamily).fontWeight(TYPE_APP_INHERITED_BODY.fontWeight).fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).layoutWeight(1);
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Text('清除').fontFamily(TYPE_APP_INHERITED_BODY.fontFamily).fontWeight(TYPE_APP_INHERITED_BODY.fontWeight).fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp)
            .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme)).accessibilityLevel('no');
        }.constraintSize({ minWidth: 44, minHeight: 44 }).padding(0).backgroundColor(Color.Transparent)
          .opacity(this.canClear() ? 1 : 0.5)
          .attributeModifier(new ReaderActionAccessibility('清除分组', this.canClear(), false, true,
            new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 999, 999, this.canClear()), 'nativeButton'))
          .onClick((): void => { if (this.canClear()) this.onSelect(''); });
      }.width('100%');
      Flex({ wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center,
        space: { main: LengthMetrics.vp(8), cross: LengthMetrics.vp(4) } }) {
        this.groupChip('', '默认', this.defaultOptionId);
        ForEach(this.groups, (group: BookGroup): void => {
          if (group.groupName.trim().length > 0) this.groupChip(group.groupName, group.groupName, '');
        }, (group: BookGroup): string => `${group.groupId}:${group.groupName}`);
      }.width('100%');
    }.width('100%').padding({ top: 8, bottom: 8 }).alignItems(HorizontalAlign.Start);
  }

  @Builder
  private groupChip(group: string, label: string, nativeId: string) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text(label).fontFamily(TYPE_APP_FILTER_OPTION.fontFamily).fontWeight(TYPE_APP_FILTER_OPTION.fontWeight)
          .fontSize(TYPE_APP_FILTER_OPTION.fontSizeFp).lineHeight(TYPE_APP_FILTER_OPTION.lineHeightFp as number)
          .fontColor(readerAppColor(group === this.selectedGroup ? 'TOK_GREEN' : 'TOK_INK', this.appThemeScheme))
          .accessibilityLevel('no').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .padding({ left: 12, right: 12, top: 5, bottom: 5 })
          .backgroundColor(readerAppColor(group === this.selectedGroup ? 'TOK_PRIMARY_SOFT' : 'TOK_CARD_BG', this.appThemeScheme))
          .border({ width: 1, color: readerAppColor(group === this.selectedGroup ? 'TOK_GREEN' : 'TOK_BORDER', this.appThemeScheme) })
          .borderRadius(this.chipRadius());
    }.constraintSize({ minWidth: 44, minHeight: 44, maxWidth: '100%' })
      .padding(0)
      .id(nativeId.length > 0 ? nativeId : undefined)
      .attributeModifier(new ReaderActionAccessibility(group.length === 0 ? '默认分组' : label, !this.busy,
        group === this.selectedGroup, true,
        new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 0, 999, !this.busy), 'nativeButton'))
      .onClick((): void => { if (!this.busy) this.onSelect(group); });
  }

  private canClear(): boolean { return !this.busy && this.selectedGroup.length > 0; }

  private chipRadius(): number {
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : readerWindowMetrics().systemFontScale;
    return ((TYPE_APP_FILTER_OPTION.lineHeightFp as number) * Math.max(1, scale) + 10) / 2;
  }
}
