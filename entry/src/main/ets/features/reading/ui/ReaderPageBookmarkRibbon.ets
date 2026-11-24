import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { READER_BOOKMARK_RIBBON_HEIGHT, READER_BOOKMARK_RIBBON_WIDTH } from '../presentation/ReaderPageBookmarkModel';

const RIBBON_PATH = 'M1.5,0.5 H14.5 V33 L8,27.5 L1.5,33 Z';

/** One clipped paper-top actor. Its same vector silhouette receives the moving fill mask. */
@Component
export struct ReaderPageBookmarkRibbon {
  @Prop x: number = 0;
  @Prop paperTop: number = 0;
  @Prop offsetY: number = 0;
  @Prop fillHeight: number = 0;
  @Prop alpha: number = 0;
  @Prop night: boolean = false;
  @Prop bookmarked: boolean = false;

  private ink(): string {
    return readerAppColor('TOK_READ_PRIMARY', this.night ? 'night' : 'day');
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        Path({ width: READER_BOOKMARK_RIBBON_WIDTH, height: READER_BOOKMARK_RIBBON_HEIGHT, commands: RIBBON_PATH })
          .fill(Color.Transparent).stroke(this.ink()).strokeWidth(1)
          .position({ x: 0, y: 0 });
        Stack({ alignContent: Alignment.TopStart }) {
          Path({ width: READER_BOOKMARK_RIBBON_WIDTH, height: READER_BOOKMARK_RIBBON_HEIGHT, commands: RIBBON_PATH })
            .fill(this.ink()).stroke(this.ink()).strokeWidth(1)
            .position({ x: 0, y: 0 });
        }
        .width(READER_BOOKMARK_RIBBON_WIDTH).height(this.fillHeight).clip(true)
        .position({ x: 0, y: 0 });
      }
      .width(READER_BOOKMARK_RIBBON_WIDTH).height(READER_BOOKMARK_RIBBON_HEIGHT)
      .translate({ y: this.offsetY }).opacity(this.alpha);
    }
    .width(READER_BOOKMARK_RIBBON_WIDTH).height(READER_BOOKMARK_RIBBON_HEIGHT).clip(true)
    .position({ x: this.x, y: this.paperTop })
    .accessibilityText('本页已添加书签').accessibilityLevel(this.bookmarked ? 'yes' : 'no')
    .hitTestBehavior(HitTestMode.None);
  }
}
