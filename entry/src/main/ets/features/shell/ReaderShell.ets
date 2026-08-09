import { ReadingExperience, ReadingCommit } from '../reading/LocalReadingExperience';
import { ReaderFullDirectory } from '../reading/ReaderFullDirectory';
import { SourceSwitchPanel, SourceSwitchPanelState } from '../reading/SourceSwitchPanel';
import type { SourceSwitchCandidate } from '../source/SourceSwitchGateway';
import type { LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';
import type { ReaderDirectoryChapterStartBookmarkRequest } from '../reading/ReaderDirectoryMarkerState';
import type { RemoteReadingSession } from '../reading/RemoteReadingFlowGateway';


// ReaderShell —— 阅读会话的 UI 组合层 (Batch 2, FIGMA_NATIVE_UI_ARCHITECTURE_PLAN §六)。
// 把阅读区 (ReadingExperience: ReadingSurface + ReaderControlPanel)、目录 overlay
// (ReaderFullDirectory)、换源 overlay (SourceSwitchPanel) 收进同一个 Shell, 让 Index 对
// 阅读路由只暴露一个组件。阅读会话的业务状态 (detailBook/detailToc/route/generation/
// source-switch gateway) 与持久化仍由 Index 持有, 经 props + 回调透传 —— Shell 只负责
// UI 骨架与 overlay 宿主, 不复制业务数据。
//
// 挂载契约 (与改造前 Index 内联阅读段一致):
//   - 仅当 readingSessionActive 且 book 已就绪时挂载; ReadingExperience 保持挂载,
//     opacity 随 route 在 reading/directory 间切换, 避免阅读会话被 remount。
//   - 状态栏顶部 inset 由本 Shell 自行管理 (读取 @StorageLink('statusBarHeightPx')),
//     阅读路由 Index 根 Stack 置 0 防双 padding; 底部安全区仍由 Index 根 Stack 统一沉浸。
//     保持非沉浸式观感: 阅读面与各 overlay 均避让状态栏, 不越界上移。
type PreparedReaderRoute = 'reading' | 'directory';

@Component
export struct ReaderShell {
  // 状态栏高度 (px), 用于本 Shell 自行避让顶部 inset。
  @StorageLink('statusBarHeightPx') statusBarHeightPx: number = 0;
  // 阅读内容。
  @Prop bookId: string = '';
  @Prop bookTitle: string = '';
  @Prop sourceId: string = '';
  @Prop sourceName: string = '';
  @Prop remoteSession: RemoteReadingSession | undefined = undefined;
  @Prop totalChapters: number = 0;
  @Prop requestedChapterIndex: number | undefined = undefined;
  @Prop isTablet: boolean = false;
  @Prop reduceMotion: boolean = false;
  // 阅读会话可见性: route 决定 ReadingExperience 是否露出版面。
  @Prop visible: boolean = false;
  @Prop route: PreparedReaderRoute = 'reading';
  // 目录 overlay。
  @Prop tocEntries: LocalReadingTocEntry[] = [];
  @Prop directoryCurrentChapterIndex: number = -1;
  @Prop directoryChapterTitle: string = '';
  @Prop directoryOpenedFromControl: boolean = false;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  // 换源 overlay。
  @Prop sourceSwitchVisible: boolean = false;
  @Prop sourceSwitchState: SourceSwitchPanelState = { kind: 'discovering' };

  // 回调 (全部由 Index 提供, 透传到对应子组件)。
  onExitRequestHandler: (requestExit: () => void) => void = (): void => {};
  onExit: () => void = (): void => {};
  onReadingReady: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onReadingCommitted: (commit: ReadingCommit) => void = (_commit: ReadingCommit): void => {};
  onChapterCommitted: (chapterIndex: number, chapterTitle: string) => void =
    (_chapterIndex: number, _chapterTitle: string): void => {};
  onSelectChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onDownloadChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onDeleteBookmarks: (bookmarkTimes: number[]) => void = (_bookmarkTimes: number[]): void => {};
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  onCloseDirectory: () => void = (): void => {};
  onOpenDirectory: () => void = (): void => {};
  onSwitchSource: () => void = (): void => {};
  onCloseSourceSwitch: () => void = (): void => {};
  onRetrySourceSwitch: () => void = (): void => {};
  onPickSource: (candidate: SourceSwitchCandidate) => void = (_candidate: SourceSwitchCandidate): void => {};
  onRollbackSourceSwitch: () => void = (): void => {};

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // This stable nested layer prevents the reader component from being
      // remounted when sibling overlays appear.  Opacity 0 still receives the
      // true viewport/layout pass; `Visibility` would make the TextController
      // metrics unavailable.
      Stack({ alignContent: Alignment.TopStart }) {
        ReadingExperience({
          sourceId: this.sourceId,
          bookId: this.bookId,
          remoteSession: this.remoteSession,
          requestedChapterIndex: this.requestedChapterIndex,
          isTablet: this.isTablet,
          bookTitle: this.bookTitle,
          sourceName: this.sourceName,
          totalChapters: this.totalChapters,
          directoryEntries: this.tocEntries,
          controlObscured: this.route === 'directory',
          reduceMotion: this.reduceMotion,
          onExitRequestHandler: (requestExit: () => void): void => this.onExitRequestHandler(requestExit),
          onExit: (): void => this.onExit(),
          onReadingReady: (chapterIndex: number): void => this.onReadingReady(chapterIndex),
          onReadingCommitted: (commit: ReadingCommit): void => this.onReadingCommitted(commit),
          onChapterCommitted: (chapterIndex: number, chapterTitle: string): void =>
            this.onChapterCommitted(chapterIndex, chapterTitle),
          onOpenDirectory: (): void => this.onOpenDirectory(),
          onSwitchSource: (): void => this.onSwitchSource(),
          onDownloadChapter: (chapterIndex: number): void => this.onDownloadChapter(chapterIndex),
          onDeleteBookmarks: (bookmarkTimes: number[]): void => this.onDeleteBookmarks(bookmarkTimes),
          chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
          onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
            this.onCreateChapterStartBookmark(request),
        })
          .width('100%')
          .height('100%')
          .opacity(this.route === 'reading' || this.route === 'directory' ? 1 : 0);
      }
      .width('100%')
      .height('100%')
      // A transparent lifecycle container must never become an invisible
      // input shield over Local Book Detail.
      .hitTestBehavior(HitTestMode.Transparent);

      if (this.route === 'directory') {
        ReaderFullDirectory({
          bookTitle: this.bookTitle,
          chapterTitle: this.directoryChapterTitle,
          entries: this.tocEntries,
          currentChapterIndex: this.directoryCurrentChapterIndex,
          isTablet: this.isTablet,
          sourceId: this.sourceId,
          animateFromControl: this.directoryOpenedFromControl,
          reduceMotion: this.reduceMotion,
          onSelectChapter: (chapterIndex: number): void => this.onSelectChapter(chapterIndex),
          onDownloadChapter: (chapterIndex: number): void => this.onDownloadChapter(chapterIndex),
          onDeleteBookmarks: (bookmarkTimes: number[]): void => this.onDeleteBookmarks(bookmarkTimes),
          chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
          onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
            this.onCreateChapterStartBookmark(request),
          onSwitchSource: (): void => this.onSwitchSource(),
          onExit: (): void => this.onCloseDirectory(),
        });
      }

      if (this.sourceSwitchVisible) {
        Stack({ alignContent: Alignment.Center }) {
          Stack()
            .width('100%')
            .height('100%')
            .backgroundColor('#40FFFFFF')
            .onClick((): void => this.onCloseSourceSwitch());
          SourceSwitchPanel({
            state: this.sourceSwitchState,
            currentSourceId: this.sourceId,
            isTablet: this.isTablet,
            onClose: (): void => this.onCloseSourceSwitch(),
            onRetry: (): void => this.onRetrySourceSwitch(),
            onSelectCandidate: (candidate: SourceSwitchCandidate): void => this.onPickSource(candidate),
            onRollback: (): void => this.onRollbackSourceSwitch(),
          });
        }
        .width('100%')
        .height('100%');
      }
    }
    .width('100%')
    .height('100%')
    // 顶部 inset 本 Shell 自行管理 (Index 置 0): 阅读面与各 overlay 统一避让状态栏。
    .padding({ top: px2vp(this.statusBarHeightPx) })
    .opacity(this.visible ? 1 : 0)
    .hitTestBehavior(this.visible ? HitTestMode.Default : HitTestMode.Transparent);
  }
}
