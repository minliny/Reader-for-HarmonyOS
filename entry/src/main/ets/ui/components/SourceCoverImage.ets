// SourceCoverImage — presentation-only consumer of the protected Core cover
// request path.  It never loads a remote coverUrl with Image(url): Core first
// resolves headers/cookie rules, SourceImageCache streams the bytes to a
// sandbox file, and only that file:// URI reaches Image.
import { CoreRuntime } from '../../bridge/CoreRuntime';
import { SourceImageLoadHandle } from '../../host/adapters/SourceImageCache';
import { ColorTokens } from '../../contract/generated/ColorTokens';

@Component
export struct SourceCoverImage {
  @Prop @Watch('reload') sourceId: string = '';
  @Prop @Watch('reload') coverUrl: string = '';
  @Prop fallback: Resource | undefined = undefined;
  @State private cachedUri: string = '';
  private requestEpoch: number = 0;
  private activeLoad: SourceImageLoadHandle | null = null;

  aboutToAppear(): void {
    this.reload();
  }

  aboutToDisappear(): void {
    this.requestEpoch += 1;
    if (this.activeLoad !== null) {
      this.activeLoad.cancel();
      this.activeLoad = null;
    }
  }

  private reload(): void {
    this.requestEpoch += 1;
    const epoch = this.requestEpoch;
    if (this.activeLoad !== null) {
      this.activeLoad.cancel();
      this.activeLoad = null;
    }
    this.cachedUri = '';
    if (!this.shouldResolveThroughCore()) return;
    if (!CoreRuntime.isInitialized()) return;
    try {
      const core = CoreRuntime.get();
      const cache = core.getSourceImageCache();
      if (cache === null) return;
      core.sourceImageRequest(this.sourceId, this.coverUrl).then((descriptor): void => {
        // The descriptor is never saved to AppStorage/UI state. A rapid row
        // reuse may have selected another book while Core was resolving it.
        if (epoch !== this.requestEpoch) return;
        const load = cache.beginLoad(descriptor.request);
        this.activeLoad = load;
        load.result.then((uri: string): void => {
          if (epoch !== this.requestEpoch) return;
          this.cachedUri = uri;
          this.activeLoad = null;
        }).catch((_error: Error): void => {
          // Fail closed: retain only the honest placeholder/fallback. Do not
          // retry with the raw remote URL, and do not log URL/cookie/auth data.
          if (epoch === this.requestEpoch) this.activeLoad = null;
        });
      }).catch((_error: Error): void => {
        // Core rejects unknown/missing persisted sources; placeholder remains.
      });
    } catch (_error) {
      // Runtime teardown races are expected during route changes. The epoch
      // guard prevents a stale resolved file from appearing in a new card.
    }
  }

  private shouldResolveThroughCore(): boolean {
    const source = this.sourceId.trim();
    const cover = this.coverUrl.trim();
    return source.length > 0 && source !== 'local' && cover.length > 0;
  }

  private localFileUri(): string {
    const source = this.sourceId.trim();
    const cover = this.coverUrl.trim();
    // Missing source identity must not be upgraded into a remote request. The
    // only direct path permitted is an already-local sandbox URI for a local
    // book; all remote http(s) values remain a placeholder.
    if ((source.length === 0 || source === 'local') && cover.startsWith('file://')) {
      return cover;
    }
    return '';
  }

  build() {
    Stack() {
      if (this.cachedUri.length > 0) {
        Image(this.cachedUri)
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Cover)
      } else if (this.localFileUri().length > 0) {
        Image(this.localFileUri())
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Cover)
      } else if (this.fallback !== undefined) {
        Image(this.fallback)
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Cover)
      } else {
        Column()
          .width('100%')
          .height('100%')
          .backgroundColor(ColorTokens.metaBg)
      }
    }
    .width('100%')
    .height('100%')
  }
}
