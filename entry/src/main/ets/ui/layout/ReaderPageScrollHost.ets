import { ReaderScrollLayout, readerScrollBottomPadding, readerScrollTopPadding } from './ReaderScrollLayout';
import { ReaderEditingVisibility } from './ReaderEditingVisibility';
import { ReaderEditingScrollBinding } from './ReaderEditingScrollBinding';

/** Standard-page Scroll host. It owns only vertical inset application; page
 * content, horizontal frame and scrolling state remain with the page. */
@Component
export struct ReaderPageScrollHost {
  scroller: Scroller = new Scroller();
  editingHost: ReaderEditingVisibility | undefined = undefined;
  private readonly editingScroll: ReaderEditingScrollBinding = new ReaderEditingScrollBinding();
  @Prop layout: ReaderScrollLayout = new ReaderScrollLayout(0, 0, 'padding');
  @BuilderParam content: () => void = this.emptySlot;
  @Builder private emptySlot() {}

  build() {
    Scroll(this.scroller) {
      Column() { this.content(); }
        .width('100%')
        .padding({ top: readerScrollTopPadding(this.layout), bottom: readerScrollBottomPadding(this.layout) });
    }
      .id(this.editingScroll.id)
      .onAppear((): void => this.editingScroll.mount(this.getUIContext(), this.editingHost, this.scroller,
        (): number => readerScrollTopPadding(this.layout)))
      .onDisAppear((): void => this.editingScroll.unmount())
      .onAreaChange((): void => this.editingHost?.refresh())
      .width('100%').height('100%').align(Alignment.TopStart).scrollBar(BarState.Off);
  }
}
