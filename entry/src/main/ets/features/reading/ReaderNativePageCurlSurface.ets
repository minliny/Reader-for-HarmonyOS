import type { image } from '@kit.ImageKit';

export const READER_PAGECURL_EVENT_RENDERER_READY = 1 << 1;
export const READER_PAGECURL_EVENT_TURN_REACHED_END = 1 << 2;
export const READER_PAGECURL_EVENT_TURN_CANCELLED = 1 << 3;
export const READER_PAGECURL_EVENT_HOST_PRESENT_ACKNOWLEDGED = 1 << 4;
export const READER_PAGECURL_EVENT_RENDER_FAILED = 1 << 5;

export const READER_PAGECURL_PHASE_IDLE = 0;
export const READER_PAGECURL_PHASE_PREPARING = 1;
export const READER_PAGECURL_PHASE_ARMED = 2;
export const READER_PAGECURL_PHASE_DRAGGING = 3;
export const READER_PAGECURL_PHASE_SETTLING_COMPLETE = 4;
export const READER_PAGECURL_PHASE_SETTLING_CANCEL = 5;
export const READER_PAGECURL_PHASE_AWAITING_HOST_COMMIT = 6;
export const READER_PAGECURL_PHASE_AWAITING_HOST_PRESENT = 7;

export const READER_PAGECURL_RELEASE_REJECTED = -1;
export const READER_PAGECURL_RELEASE_ROLLBACK = 0;
export const READER_PAGECURL_RELEASE_COMMIT = 1;

export interface ReaderNativePageCurlStatus {
  phase: number;
  sessionId: number;
  eventMask: number;
}

/** Binary/high-frequency surface context exported by libpagecurl.so. */
export interface ReaderNativePageCurlContext {
  primePage(
    textureKey: string,
    page: image.PixelMap,
  ): boolean;
  isPageReady(textureKey: string): boolean;
  prepare(
    movingTextureKey: string,
    underTextureKey: string,
    direction: number,
    sessionId: number,
  ): boolean;
  begin(sessionId: number, xNormalized: number, yNormalized: number, eventTimeMs: number): boolean;
  updatePointer(sessionId: number, xNormalized: number, yNormalized: number, eventTimeMs: number): boolean;
  /** Returns -1 rejected, 0 rollback, 1 commit. */
  release(
    sessionId: number,
    canCommit: boolean,
    velocityXPagesPerSecond: number,
    velocityYPagesPerSecond: number,
    eventTimeMs: number,
  ): number;
  hostCommitted(sessionId: number): boolean;
  hostPresented(sessionId: number): boolean;
  cancel(sessionId: number): void;
  getStatus(): ReaderNativePageCurlStatus;
}

/**
 * Non-interactive native texture surface. ArkTS remains the only gesture
 * arbiter; the surface receives pointer samples only after the host admits a
 * page turn, so it cannot steal links, selection or system edge gestures.
 */
@Component
export struct ReaderNativePageCurlSurface {
  @Prop rendererVisible: boolean = false;
  onContextReady: (context: ReaderNativePageCurlContext | undefined) => void =
    (_context: ReaderNativePageCurlContext | undefined): void => {};

  build() {
    XComponent({
      id: 'reader-native-pagecurl-surface',
      type: XComponentType.TEXTURE,
      libraryname: 'pagecurl',
    })
      .width('100%')
      .height('100%')
      // The native renderer owns the idle transparent clear. Keeping this
      // compositor layer at opacity 1 avoids waiting for an ArkUI property
      // frame after Pan has already begun; a short physical swipe can finish
      // before a 0.001 -> 1 transition is presented.
      .opacity(1)
      .hitTestBehavior(HitTestMode.None)
      .onLoad((context: object): void => {
        this.onContextReady(context as ReaderNativePageCurlContext);
      })
      .onDestroy((): void => this.onContextReady(undefined));
  }
}
