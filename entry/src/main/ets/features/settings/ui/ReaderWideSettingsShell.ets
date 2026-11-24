import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { ReaderBottomNavigation } from '../../../app/navigation/ReaderBottomNavigation';
import { publishReaderMainViewport } from '../../shell/MainNavigationSpec';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { readerSurfaceElevation } from '../../../ui/surfaces/ReaderSurfaceSpecs';

export type WideSettingsPane = 'general' | 'source' | 'bookshelfSettings' | 'downloads';

@Component
export struct ReaderWideSettingsShell {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @Prop pane: WideSettingsPane = 'general';
  @Prop collapsed: boolean = false;
  @Prop interactive: boolean = false;
  @State private paneWidth: number = 0;
  onToggle: () => void = (): void => {};
  onPane: (pane: WideSettingsPane) => void = (_pane: WideSettingsPane): void => {};
  onMainTab: (tab: string) => void = (_tab: string): void => {};
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
        .padding({ left: 14, right: 14, top: 12, bottom: 12 });
      ReaderBottomNavigation({ current: 'settings', inputEnabled: this.interactive,
        onSelect: (tab: string): void => this.onMainTab(tab) });
    }.width('100%').height('100%')
      .backgroundColor(readerAppColor('TOK_PAPER', this.scheme))
      .onAreaChange((_old: Area, next: Area): void =>
        publishReaderMainViewport(readerPageAreaLength(next.width), readerPageAreaLength(next.height)));
  }

  @Builder
  private rail() {
    Column() {
      Row() {
        if (!this.collapsed) {
          Text('设置').fontSize(16).fontWeight(FontWeight.Medium).layoutWeight(1)
            .fontColor(readerAppColor('TOK_INK', this.scheme));
        }
        Button({ type: ButtonType.Normal }) {
          Image(this.scheme === 'night' ? $r('app.media.reader_chevron_right_theme_night') : $r('app.media.reader_chevron_right'))
            .width(14).height(14).rotate({ angle: this.collapsed ? 0 : 180 }).accessibilityLevel('no');
        }.width(44).height(44).borderRadius(10).padding(0)
          .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.scheme))
          .accessibilityText(this.collapsed ? '展开设置栏' : '收起设置栏').enabled(this.interactive)
          .onClick((): void => { if (this.interactive) this.onToggle(); });
      }.width('100%').padding({ left: 6, right: 6, top: 4, bottom: 4 });
      this.railItem('general', '通用设置', 'settings_row_general');
      this.railItem('source', '书源管理', 'settings_row_source');
      this.railItem('bookshelfSettings', '书架设置', 'settings_row_shelf_search');
      this.railItem('downloads', '下载管理', 'settings_row_download');
    }.width(this.collapsed ? 56 : 164).borderRadius(16)
      .backgroundColor(readerAppColor('TOK_SURFACE', this.scheme))
      .border({ width: 1, color: readerAppColor('TOK_LINE', this.scheme) })
      .shadow(readerSurfaceElevation('raised', this.scheme)).clip(true);
  }

  @Builder
  private railItem(pane: WideSettingsPane, label: string, media: string) {
    Button({ type: ButtonType.Normal }) {
      Row({ space: this.collapsed ? 0 : 10 }) {
        Stack() {
          Image($r(`app.media.${media}${this.scheme === 'night' ? '_theme_night' : ''}`))
            .width(18).height(18).accessibilityLevel('no');
        }.width(32).height(32).borderRadius(9).backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.scheme));
        if (!this.collapsed) {
          Text(label).fontSize(14).fontWeight(FontWeight.Medium).layoutWeight(1)
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontColor(readerAppColor(this.pane === pane ? 'TOK_GREEN' : 'TOK_INK', this.scheme));
        }
      }.width('100%').justifyContent(this.collapsed ? FlexAlign.Center : FlexAlign.Start).padding({ left: 6, right: 6 });
    }.width('100%').constraintSize({ minHeight: 48 }).borderRadius(0).padding(0)
      .backgroundColor(readerAppColor(this.pane === pane ? 'TOK_PRIMARY_SOFT' : 'app.surface.transparent', this.scheme))
      .border({ width: { top: 1 }, color: readerAppColor('TOK_LINE', this.scheme) })
      .accessibilityText(label).accessibilitySelected(this.pane === pane)
      .enabled(this.interactive).onClick((): void => { if (this.interactive) this.onPane(pane); });
  }
}
