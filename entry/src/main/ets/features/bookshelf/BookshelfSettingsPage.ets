import { READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset } from '../common/ReaderFloatingBarMetrics';
import { ReaderThemeHost } from '../../app/ReaderThemeHost';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { PageBackBar } from '../common/PageBackBar';
import { registerReaderFonts } from '../common/ReaderFonts';
import { readerVisualSafeLeft, readerVisualSafeRight } from '../common/ReaderWindowMetrics';
import { SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame } from '../common/SurfaceHorizontalGeometry';
import {
  TOK_INK, TOK_MUTED, TOK_GREEN, TOK_CARD_BG, TOK_PAPER, TOK_BORDER,
  TOK_CONTENT_MAX_W_TABLET, TOK_SCREEN_INSET, TOK_SPACE_XS, TOK_SPACE_MD,
} from '../common/ReaderTokens';
import { WebDavCredentialStore } from '../sync/WebDavCredentialStore';

/** Persistent bookshelf preferences, shared by More and the settings route. */
@Component
export struct BookshelfSettingsPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;

  @StorageLink('readerBookshelfViewMode') private mode: string = 'cover';
  @Prop autoCheckUpdate: boolean = true;
  onBack: () => void = (): void => {};
  onAutoCheckUpdate: (enabled: boolean) => void = (_enabled: boolean): void => {};
  @State private error: string = '';
  private revision: number = 0;
  private confirmed: string = 'cover';
  private requestedMode: 'cover' | 'list' = 'cover';
  private mounted: boolean = false;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.mounted = true;
    this.confirmed = this.mode;
  }
  aboutToDisappear(): void { this.mounted = false; this.revision += 1; }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Scroll() {
        Column() {
          Column({ space: TOK_SPACE_MD }) {
            Row() {
              Text('自动检查更新').layoutWeight(1).fontSize(15).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
              Toggle({ type: ToggleType.Switch, isOn: this.autoCheckUpdate })
                .selectedColor(readerAppColor('TOK_GREEN', this.appThemeScheme)).onChange((enabled: boolean): void => this.onAutoCheckUpdate(enabled));
            }.width('100%');
            Text('自动检查书架中书籍的最新章节').fontSize(12).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).width('100%');
            Row({ space: 12 }) {
              Text('显示方式').layoutWeight(1).fontSize(15).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
              this.modeOption('cover', '封面');
              this.modeOption('list', '列表');
            }.width('100%');
            if (this.error.length > 0) {
              Text(this.error).fontSize(12).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
                .onClick((): void => this.selectMode(this.requestedMode));
            }
          }.padding(TOK_SPACE_MD).width('100%').backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
            .border({ width: 1, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(12);
        }
        .width('100%')
        .padding({ left: this.contentFrame().left, right: this.contentFrame().right,
          top: READER_FLOATING_TOP_BAR_HEIGHT + TOK_SPACE_XS, bottom: this.bottomContentInset() });
      }
      .height('100%').width('100%').align(Alignment.TopStart).scrollBar(BarState.Off);
      PageBackBar({ title: '书架设置', onBack: (): void => this.onBack() });
    }.width('100%').height('100%').backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme));
  }


  private bottomContentInset(): number {
    if (this.readerWindowMetricsRevision < 0) return TOK_SPACE_MD;
    return readerFloatingBarBottomInset(ReaderWindowCoordinator.metrics(), TOK_SPACE_MD);
  }
  private contentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const metrics = ReaderWindowCoordinator.metrics();
    return resolveHorizontalFrame(metrics.windowRect.width, readerVisualSafeLeft(metrics), readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(TOK_CONTENT_MAX_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET));
  }

  @Builder
  private modeOption(value: 'cover' | 'list', label: string) {
    Text(label).fontSize(13).fontColor(this.mode === value ? readerAppColor('app.BookshelfSettingsPage.modeOption.onSelected', this.appThemeScheme) : readerAppColor('TOK_GREEN', this.appThemeScheme))
      .padding({ left: 14, right: 14, top: 10, bottom: 10 }).borderRadius(20)
      .backgroundColor(this.mode === value ? readerAppColor('app.action.fill', this.appThemeScheme) : readerAppColor('TOK_PAPER', this.appThemeScheme))
      .onClick((): void => this.selectMode(value));
  }

  private async persistRequestedMode(mode: 'cover' | 'list', revision: number): Promise<boolean> {
    await ReaderThemeHost.prepareUserChange();
    if (!this.mounted || revision !== this.revision) return false;
    this.confirmed = await WebDavCredentialStore.instance.loadBookshelfViewMode();
    if (!this.mounted || revision !== this.revision) return false;
    await WebDavCredentialStore.instance.saveBookshelfViewMode(mode);
    return true;
  }

  private selectMode(mode: 'cover' | 'list'): void {
    const revision = ++this.revision;
    this.requestedMode = mode;
    this.mode = mode;
    this.error = '';
    void this.persistRequestedMode(mode, revision).then((committed: boolean): void => {
      if (committed) this.confirmed = mode;
    }).catch((error: Error): void => {
      if (!this.mounted || revision !== this.revision) return;
      this.mode = this.confirmed;
      this.error = error.message === 'BOOKSHELF_RESTORE_PENDING' ?
        '请先在同步设置中重试未完成的恢复' : '显示方式保存失败，点击重试';
    });
  }
}
