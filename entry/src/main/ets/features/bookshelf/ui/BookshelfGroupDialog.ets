import { FrameCallback } from '@kit.ArkUI';
import { BookshelfGroupPresentation } from '../presentation/BookshelfGroupPresentation';
import { BookshelfGroupSelector } from './BookshelfGroupSelector';
import { ReaderDialogSurface } from '../../../ui/surfaces/ReaderDialogSurface';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';

class BookshelfGroupFocusFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void {}
  onIdle(_remaining: number): void { this.action(); }
}

@Component
export struct BookshelfGroupDialog {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') private foreground: boolean = true;
  @ObjectLink presentation: BookshelfGroupPresentation;
  @Prop recoveryTop: number = 0;
  isInputAllowed: (() => boolean) | undefined = undefined;

  build() {
    if (this.presentation.book !== undefined) {
      ForEach([this.presentation.identity], (identity: string): void => {
        this.surface(identity);
      }, (identity: string): string => identity);
    }
  }

  @Builder
  private surface(identity: string) {
    Stack({ alignContent: Alignment.Center }) {
      Row().width('100%').height('100%').backgroundColor(readerAppColor('app.scrim.modal', this.appThemeScheme))
        .accessibilityLevel('no')
        .onClick((): void => { if (this.groupInputIsCurrent(identity)) this.presentation.dismiss(identity); });
      ReaderDialogSurface({ specId: 'shelf-group', title: '编辑分组', actions: [],
        body: (): void => { this.selector(identity); } });
      Column() {
        if (this.presentation.snapshot.receipt !== undefined) {
          ForEach([this.presentation.snapshot.receipt.facts.generation], (expected: number): void => {
            this.recovery(identity, expected);
          }, (expected: number): string => expected.toString());
        }
      }.width('100%').padding({ left: 16, right: 16, top: this.recoveryTop + 12 })
        .align(Alignment.Top).zIndex(1).hitTestBehavior(HitTestMode.Transparent);
    }.width('100%').height('100%')
      .id(this.focusScopeKey(identity)).focusable(true).focusScopeId(this.focusScopeKey(identity), true, false)
      .onAppear((): void => this.requestFocusAfterFrame((): boolean => this.presentation.identity === identity,
        this.selectorFocusKey(identity), this.focusScopeKey(identity)))
      .onDisAppear(this.restoreFocusAction(identity));
  }

  @Builder
  private selector(identity: string) {
    BookshelfGroupSelector({
      selected: (this.presentation.book?.group?.trim() ?? '') === '',
      busy: this.presentation.assigning || this.presentation.snapshot.busy || this.presentation.snapshot.mutationBlocked === true,
      focusId: this.selectorFocusKey(identity),
      onSelect: (): void => { if (this.groupInputIsCurrent(identity)) void this.presentation.assignDefault(identity); },
    });
  }

  private groupInputIsCurrent(identity: string): boolean {
    return this.foreground && identity.length > 0 && this.presentation.identity === identity &&
      (this.isInputAllowed?.() ?? true);
  }

  private focusScopeKey(identity: string): string { return `reader-shelf-group:${identity}`; }

  private selectorFocusKey(identity: string): string { return `${this.focusScopeKey(identity)}:default`; }

  private restoreFocusAction(identity: string): () => void {
    const restore = this.presentation.captureFocusReturn(identity);
    return (): void => {
      if (restore !== undefined) {
        this.requestFocusAfterFrame(restore.isCurrent, restore.target ?? '', 'reader-bookshelf-search-entry');
      }
    };
  }

  private requestFocusAfterFrame(current: () => boolean, preferred: string, fallback: string): void {
    try {
      this.getUIContext().postFrameCallback(new BookshelfGroupFocusFrame((): void => {
        if (!this.foreground || !current()) return;
        const focus = this.getUIContext().getFocusController();
        if (preferred.length > 0) {
          try { focus.requestFocus(preferred); return; } catch (_unavailableTarget) {}
        }
        try { focus.requestFocus(fallback); } catch (_unavailableFallback) {}
      }));
    } catch (_detached) {}
  }

  @Builder
  private recovery(identity: string, expected: number) {
    ReaderRecoveryNotice({
      view: this.presentation.recovery(expected), tag: '分组', actionLabel: '核对分组',
      busy: this.presentation.snapshot.busy,
      secondaryActionLabel: this.presentation.canContinue(expected) ? '继续原分组操作' : '',
      onReconcile: (_expected: number): void => {
        if (this.groupInputIsCurrent(identity)) this.presentation.reconcile(identity, expected);
      },
      onSecondaryAction: (_expected: number): void => {
        if (this.groupInputIsCurrent(identity)) this.presentation.reconcile(identity, expected, true);
      },
    });
  }
}
