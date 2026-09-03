import {
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceSnapshot,
} from './ReaderAppearanceState';
import {
  createDefaultReaderReadingLayout,
  type ReaderReadingLayoutSnapshot,
} from './ReaderLayoutGeometry';
import { ReaderPageTurnRenderPage } from './ReaderPageTurnStage';
import { ReadingSurface } from './ReadingSurface';

/**
 * Immutable input for one offscreen page raster.
 *
 * Dynamic TTS/Auto Page highlights, selection UI and the session capsule are
 * deliberately absent. They remain live ArkUI overlays and can never be
 * frozen into a page texture that is reused by the native renderer.
 */
export class BookTurnTextureBuildInput {
  page: ReaderPageTurnRenderPage;
  viewportWidth: number;
  viewportHeight: number;
  layout: ReaderReadingLayoutSnapshot;
  appearance: ReaderAppearanceSnapshot;

  constructor(
    page: ReaderPageTurnRenderPage,
    viewportWidth: number,
    viewportHeight: number,
    layout: ReaderReadingLayoutSnapshot = createDefaultReaderReadingLayout(),
    appearance: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot(),
  ) {
    this.page = page;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.layout = layout;
    this.appearance = appearance;
  }
}

/** A one-shot offscreen tree consumed only by ComponentSnapshot. */
@Builder
export function BookTurnTextureBuilder(input: BookTurnTextureBuildInput) {
  Stack({ alignContent: Alignment.TopStart }) {
    ReadingSurface({
      chapterTitle: input.page.chapterTitle,
      showChapterTitle: input.page.showChapterTitle,
      pageFragments: input.page.fragments,
      layout: input.layout,
      appearance: input.appearance,
      bottomJustifyGap: input.page.bottomJustifyGap,
      chromeTopStartText: input.page.chromeTopStartText,
      chromeTopEndText: input.page.chromeTopEndText,
      chromeBottomStartText: input.page.chromeBottomStartText,
      chromeBottomEndText: input.page.chromeBottomEndText,
      chromeSessionVisible: false,
      chromeSessionWidth: 0,
      chromeSessionHeight: 0,
    });
  }
  .width(input.viewportWidth)
  .height(input.viewportHeight)
  .clip(true);
}
