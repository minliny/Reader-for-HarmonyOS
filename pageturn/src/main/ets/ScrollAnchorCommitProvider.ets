// ScrollAnchorCommitProvider - the host-private implementation of the
// reader.scroll.anchor-commit.v1 capability.
//
// This is the engineering wrapper the contract asks for: it does NOT invent a
// new continuous-reading design. It extracts the existing native scroll anchor
// resolution (ReaderComponents.ets reportVerticalScrollAnchor, which resolved
// a character anchor from Scroll.onScrollStop) into a lease-gated capability
// provider that:
//   - binds the live continuous content (the vertical fragment layouts + total
//     source length) the paginator already produced;
//   - subscribes to the native scroll phase (the host feeds live offsets);
//   - resolves the live character anchor on native scroll idle;
//   - commits that anchor only after Core returns stored=true (the coordinator
//     submits it through the progress bridge); on failure, restores the last
//     committed anchor.
//
// Continuous reading is NOT a new design here. The provider only adds the
// lease/transaction boundary the contract pins (scrollPersistence.trigger=
// "on-native-scroll-idle", anchor="resolve-live-character-anchor", commit=
// "after-reader.progress.update-stored-true", failure=
// "restore-last-committed-anchor").
//
// registerWhen/withdrawWhen gate on provider-self-check-passes + the reader
// runtime session/surface/content revisions + the progress store bridge; a
// provider whose self-check later fails is withdrawn with providerLoss.
import {
  PageTurnProviderHandle, PageTurnOperationResult, PageTurnOperationRequest,
  OperationName,
} from './PageTurnProviderRegistry';
import { PageTurnCapabilityId } from './PageTurnContract';

// The vertical fragment layout the paginator produces. Mirrors the fields
// reportVerticalScrollAnchor consumes (top/height/sourceOffset/contentIdentity)
// without depending on the @Component that owns them.
export interface ScrollAnchorLayout {
  top: number;
  height: number;
  sourceOffset: number;
  bookId: string;
  sourceId: string;
  chapterIndex: number;
}

// A resolved character anchor ready to commit to Core.
export interface ScrollAnchor {
  bookId: string;
  sourceId: string;
  chapterIndex: number;
  sourceOffset: number;
  progress: number;
}

export class ScrollAnchorCommitProvider implements PageTurnProviderHandle {
  private layouts: ScrollAnchorLayout[] = [];
  private sourceLength: number = 0;
  private liveOffset: number = 0;
  private lastCommitted: ScrollAnchor | null = null;
  private bound: boolean = false;

  capability(): PageTurnCapabilityId {
    return 'reader.scroll.anchor-commit.v1';
  }

  providerKind(): string {
    return 'scroll-anchor-commit-provider';
  }

  requiredOperations(): OperationName[] {
    return [
      'bind-live-continuous-content',
      'subscribe-native-scroll-phase',
      'resolve-anchor-on-native-idle',
      'commit-anchor-after-stored-true',
      'restore-last-committed-anchor',
      'dispose',
    ];
  }

  // registerWhen gates on provider-self-check-passes + reader-runtime-content-
  // revision-current. A provider with no bound content is not ready.
  selfCheckPasses(): boolean {
    return this.bound && this.layouts.length > 0;
  }

  // ── host domain methods (called directly by the scroll component, gated by
  // the lease the coordinator acquired) ───────────────────────────────────
  bindLiveContinuousContent(layouts: ScrollAnchorLayout[], sourceLength: number): void {
    this.layouts = layouts;
    this.sourceLength = sourceLength;
    this.bound = true;
  }

  onNativeScrollPhase(offset: number): void {
    this.liveOffset = offset < 0 ? 0 : offset;
  }

  // resolve-anchor-on-native-idle. This is the same anchor resolution
  // reportVerticalScrollAnchor performed (find the fragment containing the
  // scroll position, else the nearest-before, else the first), now expressed as
  // a pure function of the bound layouts + live offset so it is testable
  // without a @Component.
  resolveAnchorOnIdle(): ScrollAnchor | null {
    if (!this.bound || this.layouts.length === 0) return null;
    const y = this.liveOffset < 0 ? 0 : this.liveOffset;
    let anchor: ScrollAnchorLayout | null = null;
    let nearestBefore: ScrollAnchorLayout | null = null;
    let first: ScrollAnchorLayout | null = null;
    for (let i = 0; i < this.layouts.length; i++) {
      const item = this.layouts[i];
      if (first === null || item.top < first.top) first = item;
      if (item.top <= y && (nearestBefore === null || item.top > nearestBefore.top)) {
        nearestBefore = item;
      }
      if (item.top <= y && item.top + item.height > y) {
        anchor = item;
        break;
      }
    }
    const selected = anchor !== null ? anchor : (nearestBefore !== null ? nearestBefore : first);
    if (selected === null) return null;
    const progress = this.sourceLength > 0
      ? (selected.sourceOffset / this.sourceLength)
      : 0;
    const clamped = progress < 0 ? 0 : (progress > 1 ? 1 : progress);
    return {
      bookId: selected.bookId,
      sourceId: selected.sourceId,
      chapterIndex: selected.chapterIndex,
      sourceOffset: selected.sourceOffset,
      progress: clamped,
    };
  }

  // commit-anchor-after-stored-true: record the anchor Core just stored so a
  // later failure can restore it.
  recordCommittedAnchor(anchor: ScrollAnchor): void {
    this.lastCommitted = anchor;
  }

  restoreLastCommittedAnchor(): ScrollAnchor | null {
    return this.lastCommitted;
  }

  clearTransient(): void {
    this.liveOffset = 0;
  }

  dispose(): void {
    this.layouts = [];
    this.sourceLength = 0;
    this.liveOffset = 0;
    this.lastCommitted = null;
    this.bound = false;
  }

  // ── registry-routed operations (invoke through a live lease only) ──────
  onOperation(operation: OperationName, _request: PageTurnOperationRequest): PageTurnOperationResult {
    if (operation === 'bind-live-continuous-content') {
      // Binding is a host-domain call (needs layout data); report readiness.
      return { status: 'completed', detail: this.bound ? 'bound' : 'not-bound' };
    }
    if (operation === 'subscribe-native-scroll-phase') {
      return { status: 'completed', detail: 'subscribed' };
    }
    if (operation === 'resolve-anchor-on-native-idle') {
      const anchor = this.resolveAnchorOnIdle();
      return { status: 'completed', detail: anchor !== null ? 'resolved' : 'no-anchor' };
    }
    if (operation === 'commit-anchor-after-stored-true') {
      return { status: 'completed', detail: this.lastCommitted !== null ? 'committed' : 'nothing-to-commit' };
    }
    if (operation === 'restore-last-committed-anchor') {
      return { status: 'completed', detail: this.lastCommitted !== null ? 'restored' : 'no-last-committed' };
    }
    if (operation === 'dispose') {
      this.dispose();
      return { status: 'completed', detail: 'disposed' };
    }
    return { status: 'rejected-unknown-operation', detail: operation };
  }

  onLeaseLost(_leaseId: string, _reason: string): void {
    // lossBeforeStored: clear the transient scroll offset; the last committed
    // anchor is retained so the host can restore it.
    this.clearTransient();
  }
}
