import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import type { ReaderAppearanceTheme } from '../application/ReaderAppearanceState';
import { readerAppearanceThemeStyle } from './ReaderAppearanceRenderStyle';

interface ReaderReadingFailureLayout {
  width: number;
  height: number;
  left: number;
  top: number;
}

export interface ReaderSourceSwitchRecoveryTarget {
  transactionId: string | undefined;
  scopeId: number;
  selectionToken: number;
}

/** Scrollable failure presentation. Reading and source-switch owners admit each action. */
@Component
export struct ReaderReadingFailureSurface {
  @Prop theme: ReaderAppearanceTheme = 'day';
  @Prop layout: ReaderReadingFailureLayout = { width: 0, height: 0, left: 0, top: 0 };
  @Prop sourceSwitchFailureMessage: string = '';
  @Prop failureHint: string = '';
  @Prop sourceSwitchScopeId: number = 0;
  @Prop recoveryGeneration: number | undefined = undefined;
  @Prop recoveryActionLabel: string = '';
  @Prop rollbackInFlight: boolean = false;
  @Prop rollbackTarget: ReaderSourceSwitchRecoveryTarget | undefined = undefined;
  @Prop switchSourceFocusId: string | undefined = undefined;
  onRetryFailedSourceSwitch: (scopeId: number) => void = (_scopeId: number): void => {};
  onRetryRecovery: (generation: number) => void = (_generation: number): void => {};
  onRetryReading: () => void = (): void => {};
  onOpenSettings: () => void = (): void => {};
  onDismissSourceSwitchFailure: (scopeId: number) => void = (_scopeId: number): void => {};
  onRollbackSourceSwitch: (target: ReaderSourceSwitchRecoveryTarget) => void =
    (_target: ReaderSourceSwitchRecoveryTarget): void => {};
  onSwitchSource: () => void = (): void => {};

  @Builder
  private failureActions() {
    Column({ space: 12 }) {
      if (this.sourceSwitchFailureMessage.length > 0) {
        ForEach([this.sourceSwitchScopeId], (scopeId: number): void => {
          ReaderRecoveryAction({ label: '重试', onReconcile: (): void => this.onRetryFailedSourceSwitch(scopeId) });
        }, (scopeId: number): string => `${scopeId}`);
      } else {
        if (this.recoveryGeneration !== undefined) {
          ForEach([this.recoveryGeneration], (generation: number): void => {
            ReaderRecoveryAction({ label: this.recoveryActionLabel,
              onReconcile: (): void => this.onRetryRecovery(generation) });
          }, (generation: number): string => `${generation}`);
        } else {
          ReaderRecoveryAction({ label: '重试', actionEnabled: !this.rollbackInFlight,
            onReconcile: (): void => this.onRetryReading() });
        }
      }
      ReaderRecoveryAction({ label: '阅读设置', onReconcile: (): void => this.onOpenSettings() });
      if (this.sourceSwitchFailureMessage.length > 0) {
        ForEach([this.sourceSwitchScopeId], (scopeId: number): void => {
          ReaderRecoveryAction({ label: '继续当前书源', onReconcile: (): void => this.onDismissSourceSwitchFailure(scopeId) });
        }, (scopeId: number): string => `${scopeId}`);
      }
      if (this.rollbackTarget !== undefined) {
        ForEach([this.rollbackTarget], (target: ReaderSourceSwitchRecoveryTarget): void => {
          ReaderRecoveryAction({ label: '换回原书源', isBusy: this.rollbackInFlight,
            onReconcile: (): void => this.onRollbackSourceSwitch(target) });
        }, (target: ReaderSourceSwitchRecoveryTarget): string =>
          JSON.stringify([target.transactionId, target.scopeId, target.selectionToken]));
      }
      if (this.switchSourceFocusId !== undefined) {
        ReaderRecoveryAction({ label: '切换书源', actionEnabled: !this.rollbackInFlight, focusId: this.switchSourceFocusId,
          onReconcile: (): void => this.onSwitchSource() });
      }
    }
    .width('100%');
  }

  build() {
    Scroll() {
      ReaderPageState({
        title: this.sourceSwitchFailureMessage.length > 0 ? '换源未完成' : '正文暂时无法显示',
        message: this.sourceSwitchFailureMessage.length > 0 ? this.sourceSwitchFailureMessage : this.failureHint,
        padded: false, customActions: true,
        inkColor: readerAppearanceThemeStyle(this.theme).ink,
        mutedColor: readerAppearanceThemeStyle(this.theme).ink,
        actionContent: (): void => this.failureActions(),
      }).padding(24);
    }
    .width(this.layout.width)
    .height(this.layout.height)
    .position({ x: this.layout.left, y: this.layout.top })
    .backgroundColor(readerAppearanceThemeStyle(this.theme).paperStart)
    .zIndex(6);
  }
}
