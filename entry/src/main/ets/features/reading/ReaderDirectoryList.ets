import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';

/**
 * Shared directory list frame for both directory panels. Owns only the safe
 * virtualization policy (lazy creation, no row-node reuse) and the first-layout
 * notification; row content stays with each panel through `rowBuilder`.
 * The builder argument is not reactive: projections must remount the list
 * branch (projectionMountPrimary alternation) after a data change.
 */
@Component
export struct ReaderDirectoryList {
  @Prop entries: LocalReadingTocEntry[] = [];
  @Prop rowHeight: number = 40;
  @Prop listPaddingX: number = 0;
  @Prop listPaddingY: number = 0;
  @Prop edgeEffectMode: EdgeEffect = EdgeEffect.None;
  scroller: Scroller | undefined = undefined;
  onFirstLayout: () => void = (): void => {};
  @BuilderParam rowBuilder: (repeatItem: RepeatItem<LocalReadingTocEntry>) => void;

  private layoutReady: boolean = false;

  build() {
    List({ space: 0, scroller: this.scroller }) {
      Repeat(this.entries)
        .each((repeatItem: RepeatItem<LocalReadingTocEntry>) => {
          ListItem() {
            this.rowBuilder(repeatItem);
          }
          .width('100%')
          .height(this.rowHeight);
        })
        .key((entry: LocalReadingTocEntry): string => `reader-directory-row-${entry.index}`)
        // On the current phone runtime, reusable Repeat nodes cycle materialized
        // rows through a long TOC without refreshing their text. Keep lazy
        // creation, but never reuse those rows.
        .virtualScroll({ totalCount: this.entries.length, reusable: false });
    }
    .width('100%')
    .height('100%')
    .padding({
      left: this.listPaddingX,
      right: this.listPaddingX,
      top: this.listPaddingY,
      bottom: this.listPaddingY,
    })
    .scrollBar(BarState.Off)
    .edgeEffect(this.edgeEffectMode)
    .onAreaChange((_oldArea: Area, newArea: Area): void => {
      if (!this.layoutReady && (newArea.height as number) > 0) {
        this.layoutReady = true;
        this.onFirstLayout();
      }
    });
  }
}
