import { readerAppColor } from './ReaderThemeRegistry';
import { ReaderFixedHeaderHost } from './ReaderFixedHeaderHost';
import { ReaderHeaderKind, ReaderPageFrameModifier, ReaderPageShellKind, readerPageAreaLength } from './ReaderPageShell';

/** One native frame for finite categories. Geometry inputs are measured safe,
 * rail or card offsets. Visual surfaces and layers stay at the shared owner. */
@Component
export struct ReaderPageScaffold {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  // Runtime reader paper is a window-owner fact, never a caller style prop.
  @StorageLink('readerWindowChromeUnderlayColor') private readingUnderlayColor: string = readerAppColor('app.window.background', 'day');
  @Prop variant: ReaderPageShellKind = 'standard';
  // Hidden reading sessions still receive real layout and retain their actors.
  @Prop pageVisible: boolean = true;
  @Prop readingContentKind: 'text' | 'manga' = 'text';
  @Prop headerKind: ReaderHeaderKind = 'standard';
  @Prop headerMeasurementKey: number = 0;
  @Prop headerTop: number = 0;
  @Prop headerInsetLeft: number = 0;
  @Prop headerInsetRight: number = 0;
  @Prop footerInsetLeft: number = 0;
  @Prop footerInsetRight: number = 0;
  @Prop footerBottom: number = 0;
  @Prop frameInsetLeft: number = 0;
  @Prop frameInsetRight: number = 0;
  onHeaderHeightChange: (height: number, presentedKey: number) => void = (_height: number, _presentedKey: number): void => {};
  onFooterHeightChange: (height: number) => void = (_height: number): void => {};
  @BuilderParam content: () => void = this.emptySlot;
  @BuilderParam header: () => void = this.emptySlot;
  @BuilderParam footer: () => void = this.emptySlot;
  @BuilderParam overlayContent: () => void = this.emptySlot;
  @Builder private emptySlot() {}

  build() {
    Stack({ alignContent: this.variant === 'detail' || this.variant === 'mangaDetail' || this.variant === 'mangaDirectory' ? Alignment.Top : Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) { this.content(); }
        .width('100%').height('100%').zIndex(0);
      Column() {
        ReaderFixedHeaderHost({ kind: this.headerKind, measurementKey: this.headerMeasurementKey,
          content: (): void => { this.header(); },
          onHeightChange: (height: number, presentedKey: number): void => this.onHeaderHeightChange(height, presentedKey) });
      }.width('100%').padding({ left: this.headerInsetLeft, right: this.headerInsetRight })
        .margin({ top: this.headerTop }).zIndex(10).hitTestBehavior(HitTestMode.Transparent);
      Stack({ alignContent: Alignment.Bottom }) {
        Column() { this.footer(); }
          .width('100%').padding({ left: this.footerInsetLeft, right: this.footerInsetRight })
          .margin({ bottom: this.footerBottom })
          .onAreaChange((_old: Area, next: Area): void => {
            const height = readerPageAreaLength(next.height);
            if (Number.isFinite(height) && height >= 0) this.onFooterHeightChange(height);
          });
      }.width('100%').height('100%').zIndex(20).hitTestBehavior(HitTestMode.Transparent);
      Stack({ alignContent: Alignment.TopStart }) { this.overlayContent(); }
        .width('100%').height('100%').zIndex(30).hitTestBehavior(HitTestMode.Transparent);
    }.width('100%').height('100%')
      .padding({ left: this.frameInsetLeft, right: this.frameInsetRight })
      .attributeModifier(new ReaderPageFrameModifier(this.appThemeScheme, this.variant, this.readingUnderlayColor))
      .expandSafeArea(this.variant === 'reader' ? (this.readingContentKind === 'manga' ? [SafeAreaType.SYSTEM, SafeAreaType.CUTOUT] : [SafeAreaType.SYSTEM]) : [],
        this.variant === 'reader' ? (this.readingContentKind === 'manga' ? [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END] : [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM]) : [])
      .ignoreLayoutSafeArea(this.variant === 'reader' && this.readingContentKind === 'manga' ? [LayoutSafeAreaType.SYSTEM] : [],
        this.variant === 'reader' && this.readingContentKind === 'manga' ? [LayoutSafeAreaEdge.ALL] : [])
      .opacity(this.pageVisible ? 1 : 0)
      .hitTestBehavior(this.pageVisible ? HitTestMode.Default : HitTestMode.Transparent);
  }
}
