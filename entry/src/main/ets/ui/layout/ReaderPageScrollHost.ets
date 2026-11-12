import { ReaderScrollLayout, readerScrollBottomPadding, readerScrollTopPadding } from './ReaderScrollLayout';

/** Standard-page Scroll host. It owns only vertical inset application; page
 * content, horizontal frame and scrolling state remain with the page. */
@Component
export struct ReaderPageScrollHost {
  scroller: Scroller = new Scroller();
  @Prop layout: ReaderScrollLayout = new ReaderScrollLayout(0, 0, 'padding');
  @BuilderParam content: () => void = this.emptySlot;
  @Builder private emptySlot() {}

  build() {
    Scroll(this.scroller) {
      Column() { this.content(); }
        .width('100%')
        .padding({ top: readerScrollTopPadding(this.layout), bottom: readerScrollBottomPadding(this.layout) });
    }
      .width('100%').height('100%').align(Alignment.TopStart).scrollBar(BarState.Off);
  }
}
