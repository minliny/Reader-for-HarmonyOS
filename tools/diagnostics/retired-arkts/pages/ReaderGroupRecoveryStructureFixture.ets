// DEBUG component fixture. The presentation has no Runtime or Host attachment.
import { DEBUG, BUILD_MODE_NAME } from '../../../../entry/build/default/generated/profile/default/BuildProfile';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { LengthMetrics } from '@kit.ArkUI';
import { BookshelfGroupPresentation, type BookshelfGroupFocusReturn } from '../../../../entry/src/main/ets/features/bookshelf/presentation/BookshelfGroupPresentation';
import { BookshelfGroupDialog } from '../../../../entry/src/main/ets/features/bookshelf/ui/BookshelfGroupDialog';
import type { BookshelfManagementData } from '../../../../entry/src/main/ets/features/bookshelf/application/BookshelfManagementGateway';
import { projectPersistedReceipt } from '../../../../entry/src/main/ets/app/ReaderPersistedReceiptProjection';
import { projectCommitReadback } from '../../../../entry/src/main/ets/app/ReaderOperationFacts';
import { ReaderPageState } from '../../../../entry/src/main/ets/ui/feedback/ReaderPageState';
import { readerPageAreaLength } from '../../../../entry/src/main/ets/ui/layout/ReaderPageShell';

@Observed
class ReaderGroupFixturePresentation extends BookshelfGroupPresentation {
  fixtureCurrent: () => boolean = (): boolean => false;
  onFixtureAction: (kind: string) => void = (_kind: string): void => {};

  prepare(identity: string, generation: number): void {
    if (!this.fixtureCurrent()) return;
    this.focusGeneration = generation;
    this.identity = identity;
    this.book = { sourceId: 'fixture-group.example.invalid', bookId: 'memory-group-book',
      title: '内存分组样本', author: 'Fixture', addedAt: 1, group: '原分组' };
    const data: BookshelfManagementData = { groups: [], books: [this.book], records: [], totalReadTime: 0, latestReadAt: 0 };
    const message = projectCommitReadback('unknown', 'failed').message +
      '。内存分组回执样本，长文案用于验证全文与动作可达。'.repeat(24) + '分组长文案末尾。';
    this.snapshot = { data, selectedGroupId: 0, groupNameDraft: '', groupOrderDraft: '0',
      selectedSourceId: this.book.sourceId, selectedBookId: this.book.bookId,
      assignmentGroupDraft: '', busy: false, statusMessage: '', mutationBlocked: true,
      receipt: projectPersistedReceipt({ confirmation: 'unknown', readback: 'failed', value: data,
        generation, canRetry: true, message }),
      managementMutation: { confirmation: 'unknown', blocked: true, canContinueOriginal: true, message: '',
        method: 'bookshelf.group.assign', sourceId: this.book.sourceId, bookId: this.book.bookId, group: '' } };
  }

  reconcile(identity: string, expected: number, continuing: boolean = false): void {
    if (!this.fixtureCurrent() || identity !== this.identity || this.snapshot.busy ||
      this.snapshot.receipt?.facts.generation !== expected || (continuing && !this.canContinue(expected))) return;
    this.onFixtureAction(continuing ? 'continue' : 'reconcile');
  }

  dismiss(identity: string): void {
    if (!this.fixtureCurrent() || identity !== this.identity || this.snapshot.busy) return;
    this.retire();
    this.onFixtureAction('dismiss');
  }

  captureFocusReturn(identity: string): BookshelfGroupFocusReturn | undefined {
    if (!this.fixtureCurrent() || identity !== this.identity) return undefined;
    const generation = this.snapshot.receipt?.facts.generation;
    return { target: 'reader-group-fixture-open',
      isCurrent: (): boolean => this.fixtureCurrent() && this.identity.length === 0 &&
        this.focusGeneration === generation };
  }

  private focusGeneration: number = 0;
}

@Component
export struct ReaderGroupRecoveryStructureFixture {
  @Prop fontsReady: boolean = false;
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};
  @State private presentation: ReaderGroupFixturePresentation = new ReaderGroupFixturePresentation();
  @State private hostHeight: number = 180;
  @State private actionCount: number = 0;
  @State private lastAction: string = '尚未操作';
  private mounted: boolean = false;
  private opening: number = 0;
  private actualHeight: number = 0;
  private actualWidth: number = 0;
  private bridgeIdentity: string = 'group-recovery-fixture';

  aboutToAppear(): void {
    this.mounted = true;
    this.presentation.fixtureCurrent = (): boolean => this.current();
    this.presentation.onFixtureAction = (kind: string): void => {
      if (!this.current()) return;
      this.actionCount += 1;
      this.lastAction = kind;
      this.record(kind);
    };
    if (this.current()) this.onTemporaryBackBridge((): boolean => this.back(), this.bridgeIdentity);
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.presentation.retire();
    this.onTemporaryBackBridge(undefined, this.bridgeIdentity);
  }

  private current(): boolean {
    return this.mounted && this.fontsReady && DEBUG === true && BUILD_MODE_NAME === 'debug';
  }

  private openSample(): void {
    if (!this.current()) return;
    const opening = ++this.opening;
    this.presentation.prepare(`group-recovery-fixture:${opening}`, opening);
    this.record('opened');
  }

  private back(): boolean {
    if (!this.current() || this.presentation.book === undefined) return false;
    this.presentation.dismiss(this.presentation.identity);
    return true;
  }

  private record(kind: string): void {
    hilog.info(0x5244, 'ReaderPageStructure', 'READER_GROUP_FIXTURE %{public}s', JSON.stringify({
      kind, opening: this.opening, hostHeightVp: this.actualHeight, hostWidthVp: this.actualWidth,
      actionCount: this.actionCount, lastAction: this.lastAction }));
  }

  build() {
    if (DEBUG === true && BUILD_MODE_NAME === 'debug' && this.fontsReady) {
      Column({ space: 8 }) {
        Text('分组恢复 · 原生组件样本').fontSize(18);
        Text('内存回执与动作意图').fontSize(14);
        Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Center,
          space: { main: LengthMetrics.vp(8), cross: LengthMetrics.vp(8) } }) {
          Button('打开分组样本').id('reader-group-fixture-open').onClick((): void => this.openSample());
          Button('180vp').id('reader-group-fixture-height-180').onClick((): void => { this.hostHeight = 180; });
          Button('320vp').id('reader-group-fixture-height-320').onClick((): void => { this.hostHeight = 320; });
        }.width('100%');
        Text(`动作 ${this.actionCount} · ${this.lastAction}`).fontSize(14).id('reader-group-fixture-actions');
        Stack() {
          BookshelfGroupDialog({ presentation: this.presentation, recoveryTop: 0,
            isInputAllowed: (): boolean => this.current() });
        }.width('100%').height(this.hostHeight).clip(true).id('reader-group-fixture-viewport')
          .onAreaChange((_old: Area, area: Area): void => {
            this.actualHeight = readerPageAreaLength(area.height);
            this.actualWidth = readerPageAreaLength(area.width);
            if (this.current()) this.record('actual-area');
          });
      }.width('100%');
    } else {
      ReaderPageState({ title: '分组组件样本尚未就绪' });
    }
  }
}
