import { LocalReadingExperience, LocalReadingCommit } from '../reading/LocalReadingExperience';
import { ReaderFullDirectory } from '../reading/ReaderFullDirectory';
import { SourceSwitchPanel, SourceSwitchPanelState } from '../reading/SourceSwitchPanel';
import type { SourceSwitchCandidate } from '../source/SourceSwitchGateway';
import type { LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';


// ReaderShell —— 阅读会话的 UI 组合层 (Batch 2, FIGMA_NATIVE_UI_ARCHITECTURE_PLAN §六)。
// 把阅读区 (LocalReadingExperience: ReadingSurface + ReaderControlPanel)、目录 overlay
// (ReaderFullDirectory)、换源 overlay (SourceSwitchPanel) 收进同一个 Shell, 让 Index 对
// 阅读路由只暴露一个组件。阅读会话的业务状态 (detailBook/detailToc/route/generation/
// source-switch gateway) 与持久化仍由 Index 持有, 经 props + 回调透传 —— Shell 只负责
// UI 骨架与 overlay 宿主, 不复制业务数据。
//
// 挂载契约 (与改造前 Index 内联阅读段一致):
//   - 仅当 readingSessionActive 且 book 已就绪时挂载; LocalReadingExperience 保持挂载,
//     opacity 随 route 在 reading/directory 间切换, 避免阅读会话被 remount。
//   - 状态栏顶部 padding 与底部安全区由 Index 根 Stack 统一处理 (普通页面与阅读共享),
//     此处不重复叠加, 防止双 padding 回归。
type PreparedReaderRoute = 'reading' | 'directory';

@Component
export struct ReaderShell {
  // 阅读内容。
  @Prop bookId: string = '';
  @Prop bookTitle: string = '';
  @Prop sourceId: string = '';
  @Prop sourceName: string = '';
  @Prop totalChapters: number = 0;
  @Prop requestedChapterIndex: number | undefined = undefined;
  @Prop isTablet: boolean = false;
  // 阅读会话可见性: route 决定 LocalReadingExperience 是否露出版面。
  @Prop route: PreparedReaderRoute = 'reading';
  // 目录 overlay。
  @Prop tocEntries: LocalReadingTocEntry[] = [];
  @Prop directoryCurrentChapterIndex: number = -1;
  @Prop directoryChapterTitle: string = '';
  // 换源 overlay。
  @Prop sourceSwitchVisible: boolean = false;
  @Prop sourceSwitchState: SourceSwitchPanelState = { kind: 'discovering' };

  // 回调 (全部由 Index 提供, 透传到对应子组件)。
  onExitRequestHandler: (requestExit: () => void) => void = (): void => {};
  onExit: () => void = (): void => {};
  onReadingReady: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onReadingCommitted: (commit: LocalReadingCommit) => void = (_commit: LocalReadingCommit): void => {};
  onChapterCommitted: (chapterIndex: number, chapterTitle: string) => void =
    (_chapterIndex: number, _chapterTitle: string): void => {};
  onSelectChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onCloseDirectory: () => void = (): void => {};
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
        LocalReadingExperience({
          bookId: this.bookId,
          requestedChapterIndex: this.requestedChapterIndex,
          isTablet: this.isTablet,
          bookTitle: this.bookTitle,
          sourceName: this.sourceName,
          totalChapters: this.totalChapters,
          onExitRequestHandler: (requestExit: () => void): void => this.onExitRequestHandler(requestExit),
          onExit: (): void => this.onExit(),
          onReadingReady: (chapterIndex: number): void => this.onReadingReady(chapterIndex),
          onReadingCommitted: (commit: LocalReadingCommit): void => this.onReadingCommitted(commit),
          onChapterCommitted: (chapterIndex: number, chapterTitle: string): void =>
            this.onChapterCommitted(chapterIndex, chapterTitle),
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
          onSelectChapter: (chapterIndex: number): void => this.onSelectChapter(chapterIndex),
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
    .height('100%');
  }
}