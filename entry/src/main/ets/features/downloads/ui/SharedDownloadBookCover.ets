import { NoCoverCover } from '../../../ui/patterns/NoCoverCover';

/** Download-row image lifetime only. Book metadata and row actions stay with
 * the download presentation; empty/failed images use the shared placeholder. */
@Component
export struct SharedDownloadBookCover {
  @Prop @Watch('resetImage') bookKey: string = '';
  @Prop @Watch('resetImage') coverUrl: string = '';
  @Prop @Watch('resetImage') presentationGeneration: number = 0;
  @Prop coverWidth: number = 0;
  @Prop coverHeight: number = 0;
  @State private imageFailed: boolean = false;
  @State private requestGeneration: number = 0;
  private mounted: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.resetImage();
  }

  aboutToDisappear(): void {
    this.mounted = false;
  }

  private resetImage(): void {
    this.requestGeneration += 1;
    this.imageFailed = false;
  }

  private requestIdentity(): string {
    return JSON.stringify([this.bookKey, this.coverUrl.trim(), this.presentationGeneration, this.requestGeneration]);
  }

  private rejectImage(identity: string): void {
    if (!this.mounted || identity !== this.requestIdentity()) return;
    this.imageFailed = true;
  }

  build() {
    Stack() {
      if (this.coverUrl.trim().length === 0 || this.imageFailed) {
        NoCoverCover({ coverWidth: this.coverWidth, coverHeight: this.coverHeight });
      } else {
        ForEach([this.requestIdentity()], (identity: string): void => {
          Image(this.coverUrl.trim()).width(this.coverWidth).height(this.coverHeight).objectFit(ImageFit.Contain)
            .onError((): void => this.rejectImage(identity));
        }, (identity: string): string => identity);
      }
    }.width(this.coverWidth).height(this.coverHeight);
  }
}
