import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { publishReaderMainViewport } from '../../shell/MainNavigationSpec';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerMotionAnimateParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { ReaderSectionHeading } from '../../../ui/controls/ReaderSectionHeading';
import { readerSurfaceElevation } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { settingsNavigationGroups, type SettingsNavigationGroup, type SettingsNavigationItem,
  type SettingsPane } from '../presentation/SettingsNavigationItems';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../../../ui/foundation/ReaderWindowMetrics';
import { TYPE_APP_ROW_LABEL, TYPE_PAGE_TITLE } from '../../../ui/foundation/ReaderTypography';
import { TOK_BORDER_W, TOK_SPACE_SM } from '../../../ui/foundation/ReaderTokens';

@Component
export struct ReaderWideSettingsShell {
  @StorageProp('readerAppScheme') private scheme: string = 'day';
  @StorageProp('readerReduceMotion') private reduceMotion: boolean = false;
  @StorageProp('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @Prop pane: SettingsPane = 'general';
  @Prop collapsed: boolean = false;
  @Prop interactive: boolean = false;
  @Prop sharedBottomNavigationHeight: number = -1;
  @State private paneWidth: number = 0;
  onToggle: () => void = (): void => {};
  onPane: (pane: SettingsPane) => void = (_pane: SettingsPane): void => {};
  @BuilderParam content: (width: number) => void;

  build() {
    Column() {
      Row({ space: 10 }) {
        this.rail();
        Stack({ alignContent: Alignment.TopStart }) { this.content(this.paneWidth); }
          .layoutWeight(1).height('100%').borderRadius(20).clip(true)
          .backgroundColor(readerAppColor('TOK_PAPER', this.scheme))
          .border({ width: 1, color: readerAppColor('TOK_LINE_STRONG', this.scheme) })
          .onAreaChange((_old: Area, next: Area): void => {
            const width = readerPageAreaLength(next.width);
            if (width !== this.paneWidth) this.paneWidth = width;
          });
      }.layoutWeight(1).width('100%').alignItems(VerticalAlign.Top)
        .padding({ left: this.safeLeft(this.metricsRevision), right: this.safeRight(this.metricsRevision), top: 12, bottom: 12 });
      if (this.sharedBottomNavigationHeight >= 0) {
        Row().height(this.sharedBottomNavigationHeight).hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
      }
    }.width('100%').height('100%')
      .backgroundColor(readerAppColor('TOK_PAPER', this.scheme))
      .onAreaChange((_old: Area, next: Area): void =>
        publishReaderMainViewport(readerPageAreaLength(next.width), readerPageAreaLength(next.height)));
  }

  private safeLeft(_revision: number): number { return Math.max(14, readerInteractiveSafeLeft(readerWindowMetrics())); }
  private safeRight(_revision: number): number { return Math.max(14, readerInteractiveSafeRight(readerWindowMetrics())); }

  @Builder
  private rail() {
    Scroll() {
      Column() {
        Row() {
          if (!this.collapsed) {
            Text('设置').fontFamily(TYPE_PAGE_TITLE.fontFamily).fontWeight(TYPE_PAGE_TITLE.fontWeight)
              .fontSize(TYPE_PAGE_TITLE.fontSizeFp).lineHeight(TYPE_PAGE_TITLE.lineHeightFp as number).layoutWeight(1)
              .fontColor(readerAppColor('TOK_INK', this.scheme));
          }
          Row() {
            Button({ type: ButtonType.Normal, stateEffect: false }) {
              Image(this.scheme === 'night' ? $r('app.media.reader_chevron_right_theme_night') : $r('app.media.reader_chevron_right'))
                .width(14).height(14).rotate({ angle: this.collapsed ? 0 : 180 }).accessibilityLevel('no');
            }.width(32).height(32).padding(0)
              .responseRegion({ x: -6, y: -6, width: 44, height: 44 })
              .attributeModifier(new ReaderPressFeedback(readerAppColor('TOK_PRIMARY_SOFT', this.scheme),
                this.scheme, 999, 999, this.interactive))
              .accessibilityText(this.collapsed ? '展开设置栏' : '收起设置栏').enabled(this.interactive)
              .onClick((): void => { if (this.interactive) this.onToggle(); });
          }.width(44).height(44).justifyContent(FlexAlign.Center).alignItems(VerticalAlign.Center);
        }.width('100%').padding({ left: 6, right: 6, top: 4, bottom: 4 });
        ForEach(settingsNavigationGroups(), (group: SettingsNavigationGroup, index: number): void => {
          this.railGroup(group, index);
        }, (group: SettingsNavigationGroup): string => group.id);
      }.width('100%');
    }.width(this.collapsed ? 56 : 208)
      .animation(this.reduceMotion ? { duration: 0 } : readerMotionAnimateParam('app.navigation.tab', false))
      .constraintSize({ maxHeight: '100%' }).scrollBar(BarState.Auto).borderRadius(14)
      .backgroundColor(readerAppColor('TOK_CARD_BG', this.scheme))
      .border({ width: 1, color: readerAppColor('TOK_LINE', this.scheme) })
      .shadow(readerSurfaceElevation('raised', this.scheme)).clip(true);
  }

  @Builder
  private railGroup(group: SettingsNavigationGroup, index: number) {
    Column() {
      if (this.collapsed && index > 0) {
        Divider().width(28).strokeWidth(TOK_BORDER_W)
          .color(readerAppColor('TOK_LINE_STRONG', this.scheme)).margin({ top: 5, bottom: 5 });
      }
      if (!this.collapsed) {
        Column() {
          ReaderSectionHeading({ title: group.label });
        }.width('100%').padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, top: 8, bottom: 4 });
      }
      ForEach(group.items, (item: SettingsNavigationItem): void => {
        this.railItem(item);
      }, (item: SettingsNavigationItem): string => item.id);
    }.width('100%');
  }

  @Builder
  private railItem(item: SettingsNavigationItem) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: this.collapsed ? 0 : TOK_SPACE_SM }) {
        Stack() {
          Image($r(`app.media.${item.icon}${this.scheme === 'night' ? '_theme_night' : ''}`))
            .width(15).height(15).objectFit(ImageFit.Contain).accessibilityLevel('no');
        }.width(28).height(28).borderRadius(14).backgroundColor(readerAppColor('TOK_SETTING_ICON_BG', this.scheme));
        if (!this.collapsed) {
          Text(item.label).fontFamily(TYPE_APP_ROW_LABEL.fontFamily).fontWeight(TYPE_APP_ROW_LABEL.fontWeight)
            .fontSize(TYPE_APP_ROW_LABEL.fontSizeFp).lineHeight(TYPE_APP_ROW_LABEL.lineHeightFp as number)
            .halfLeading(true).layoutWeight(1)
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontColor(readerAppColor(this.pane === item.id ? 'TOK_GREEN' : 'TOK_INK', this.scheme));
        }
      }.width('100%').justifyContent(this.collapsed ? FlexAlign.Center : FlexAlign.Start)
        .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM });
    }.width('100%').constraintSize({ minHeight: 58 }).padding(0)
      .attributeModifier(new ReaderPressFeedback(
        readerAppColor(this.pane === item.id ? 'TOK_PRIMARY_SOFT' : 'app.surface.transparent', this.scheme),
        this.scheme, 0, 0, this.interactive))
      .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_ROW_DIVIDER', this.scheme) })
      .id(item.actionId ?? '').accessibilityText(item.label).accessibilitySelected(this.pane === item.id)
      .enabled(this.interactive).onClick((): void => { if (this.interactive) this.onPane(item.id); });
  }
}
