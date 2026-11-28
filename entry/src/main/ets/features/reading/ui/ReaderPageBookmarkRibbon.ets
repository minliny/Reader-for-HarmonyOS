import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { READER_BOOKMARK_GLYPH_HEIGHT_VP, READER_BOOKMARK_RIBBON_HEIGHT, READER_BOOKMARK_RIBBON_WIDTH }
  from '../presentation/ReaderPageBookmarkModel';

@Component
export struct ReaderPageBookmarkGlyph {
  @StorageProp('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @Prop color: ResourceColor = Color.Black;
  @Prop filled: boolean = false;
  @Prop heightVp: number = READER_BOOKMARK_GLYPH_HEIGHT_VP;

  private widthVp(): number {
    return this.heightVp * READER_BOOKMARK_RIBBON_WIDTH / READER_BOOKMARK_RIBBON_HEIGHT;
  }

  private pathCommands(): string {
    this.metricsRevision;
    // Path commands take pixels. Keep the original silhouette and scale both
    // axes equally for the bookmark button and the paper-top ribbon.
    const unit = this.getUIContext().vp2px(1) * this.heightVp / READER_BOOKMARK_RIBBON_HEIGHT;
    return `M${1.5 * unit},${0.5 * unit} H${14.5 * unit} V${33 * unit} ` +
      `L${8 * unit},${27.5 * unit} L${1.5 * unit},${33 * unit} Z`;
  }

  build() {
    Path({ width: this.widthVp(), height: this.heightVp, commands: this.pathCommands() })
      .fill(this.filled ? this.color : Color.Transparent).stroke(this.color).strokeWidth(1)
      .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
  }
}

/** One clipped paper-top actor. Its same vector silhouette receives the moving fill mask. */
@Component
export struct ReaderPageBookmarkRibbon {
  @Prop x: number = 0;
  @Prop paperTop: number = 0;
  @Prop paperScale: number = 1;
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
        ReaderPageBookmarkGlyph({ color: this.ink(), heightVp: READER_BOOKMARK_RIBBON_HEIGHT })
          .position({ x: 0, y: 0 });
        Stack({ alignContent: Alignment.TopStart }) {
          ReaderPageBookmarkGlyph({ color: this.ink(), heightVp: READER_BOOKMARK_RIBBON_HEIGHT, filled: true })
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
    .scale(this.paperScale < 1 ? { x: this.paperScale, y: this.paperScale, centerX: 0, centerY: 0 } : undefined)
    .accessibilityText('本页已添加书签').accessibilityLevel(this.bookmarked ? 'yes' : 'no')
    .hitTestBehavior(HitTestMode.None);
  }
}
