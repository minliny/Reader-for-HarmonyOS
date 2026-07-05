import { getMotionSpec, Motion, MotionId } from '../../contract';
import { ReaderMotion, ReaderMotionId } from '../ReaderMotion';

export interface ArkMotionSpec {
  motionId: string;
  durationMs: number;
  curve: string;
  interruptPolicy: string;
  primitive: string;
}

export class MotionAdapter {
  static p0MotionIds(): string[] {
    return [
      ReaderMotionId.appFirstOpenEnter,
      ReaderMotionId.appRoutePushForward,
      ReaderMotionId.appRoutePopBackward,
      ReaderMotionId.appRouteReplace,
      ReaderMotionId.bookshelfViewSwitch,
      ReaderMotionId.tabItemSelect,
      ReaderMotionId.tabSwitch,
      ReaderMotionId.readerSessionTtsStart,
      ReaderMotionId.readerSessionAutoPageStart,
      ReaderMotionId.readerSessionCapsuleEnter,
      ReaderMotionId.readerSessionCapsuleSwitch,
      ReaderMotionId.readerSessionCapsuleExit,
      ReaderMotionId.overlaySheetEnter,
      ReaderMotionId.overlaySheetExit,
      ReaderMotionId.overlayDialogEnter,
      ReaderMotionId.overlayDialogExit,
      ReaderMotionId.stateLoadingInline,
      ReaderMotionId.motionInterruptCancel,
      ReaderMotionId.motionInterruptRedirect,
      ReaderMotionId.motionInterruptCompleteThenReplace
    ];
  }

  static resolve(motionId: MotionId | string, reducedMotion: boolean): ArkMotionSpec {
    return {
      motionId,
      durationMs: MotionAdapter.duration(motionId, reducedMotion),
      curve: MotionAdapter.curve(motionId),
      interruptPolicy: MotionAdapter.interruptPolicy(motionId),
      primitive: MotionAdapter.primitive(motionId)
    };
  }

  static tabSwitch(reducedMotion: boolean): ArkMotionSpec {
    return MotionAdapter.resolve(ReaderMotionId.tabSwitch, reducedMotion);
  }

  static firstOpen(reducedMotion: boolean): ArkMotionSpec {
    return MotionAdapter.resolve(ReaderMotionId.appFirstOpenEnter, reducedMotion);
  }

  static generatedSpec(motionId: MotionId | string): Motion | undefined {
    return getMotionSpec(motionId as MotionId);
  }

  static duration(motionId: MotionId | string, reducedMotion: boolean): number {
    if (reducedMotion) {
      return 0;
    }
    const spec = MotionAdapter.generatedSpec(motionId);
    if (spec) {
      return spec.durationMs;
    }
    return ReaderMotion.durationRoute(false);
  }

  private static curve(motionId: MotionId | string): string {
    const spec = MotionAdapter.generatedSpec(motionId);
    if (spec) {
      return spec.easing;
    }
    return 'ease-in-out';
  }

  private static interruptPolicy(motionId: MotionId | string): string {
    if (motionId === ReaderMotionId.tabItemSelect) {
      return 'cancel-when-same-tab';
    }
    if (motionId === ReaderMotionId.tabSwitch) {
      return 'latest-tab-wins';
    }
    if (motionId === ReaderMotionId.motionInterruptCancel ||
      motionId === ReaderMotionId.motionInterruptRedirect ||
      motionId === ReaderMotionId.motionInterruptCompleteThenReplace) {
      return motionId;
    }
    if (motionId === ReaderMotionId.overlaySheetEnter ||
      motionId === ReaderMotionId.overlayDialogEnter) {
      return 'overlay-mutex';
    }
    if (motionId === ReaderMotionId.readerSessionTtsStart ||
      motionId === ReaderMotionId.readerSessionAutoPageStart ||
      motionId === ReaderMotionId.readerSessionCapsuleSwitch) {
      return 'session-mutual-exclusive';
    }
    return 'completeThenReplace';
  }

  private static primitive(motionId: MotionId | string): string {
    if (motionId === ReaderMotionId.stateLoadingInline) {
      return 'ArkUI LoadingProgress';
    }
    if (motionId === ReaderMotionId.overlaySheetEnter ||
      motionId === ReaderMotionId.overlaySheetExit) {
      return 'ArkUI sheet transition';
    }
    if (motionId === ReaderMotionId.overlayDialogEnter ||
      motionId === ReaderMotionId.overlayDialogExit) {
      return 'ArkUI dialog transition';
    }
    if (motionId === ReaderMotionId.appRoutePushForward ||
      motionId === ReaderMotionId.appRoutePopBackward ||
      motionId === ReaderMotionId.appRouteReplace) {
      return 'ArkUI router transition';
    }
    return 'ArkUI animateTo';
  }
}
