import { deviceInfo } from '@kit.BasicServicesKit';
import lazy { GestureHandlingResolution, NoneActionProposal } from '@kit.ArkUI';
import type { BaseGestureHandlingProposal } from '@kit.ArkUI';
import { readerHarmonyCapabilities } from '../../app/HarmonyCapabilityProbe';
import type { ReaderSmartGesture, ReaderSmartGestureAction } from '../../features/reading/application/ReaderSmartGesturePolicy';

export interface HarmonySmartGestureCallbacks {
  decide: (gesture: ReaderSmartGesture) => ReaderSmartGestureAction;
  dispatch: (action: ReaderSmartGestureAction) => void;
}

/** One reader owns the native monitor even across overlapping route lifetimes. */
export class HarmonySmartGestureHost {
  private static owner: HarmonySmartGestureHost | undefined;
  private release: (() => void) | undefined;
  private context: UIContext | undefined;
  private generation: number = 0;

  attach(context: UIContext, callbacks: HarmonySmartGestureCallbacks): void {
    if (this.context === context || !readerHarmonyCapabilities().api26) return;
    if (deviceInfo.distributionOSApiVersion >= 260000) {
      if (deviceInfo.apiAvailable('26.0.0')) {
        this.detach();
        HarmonySmartGestureHost.owner?.detach();
        const generation = ++this.generation;
        try {
          const controller = context.getSmartGestureController();
          const monitor = (proposal: BaseGestureHandlingProposal): GestureHandlingResolution => {
            if (this.generation !== generation) return new GestureHandlingResolution(false);
            let gesture: ReaderSmartGesture;
            switch (proposal.operateIntention) {
              case OperateIntention.TAP: gesture = 'tap'; break;
              case OperateIntention.SLIDE_FORWARD: gesture = 'slideForward'; break;
              case OperateIntention.BACK_PRESS: gesture = 'backPress'; break;
              default: return new GestureHandlingResolution(false);
            }
            let action: ReaderSmartGestureAction = 'block';
            try { action = callbacks.decide(gesture); } catch (_) {}
            if (action === 'pass') return new GestureHandlingResolution(false);
            if (action !== 'block') {
              void Promise.resolve().then((): void => {
                if (this.generation === generation && callbacks.decide(gesture) === action) callbacks.dispatch(action);
              }).catch((): void => {});
            }
            const resolution = new GestureHandlingResolution(true);
            resolution.selectedProposal = new NoneActionProposal();
            return resolution;
          };
          this.release = (): void => {
            try { controller.unregisterMonitor(monitor); } catch (_) {}
            try { controller.enableSmartTapAndSlideGestures(false); } catch (_) {}
          };
          controller.enableSmartTapAndSlideGestures(true);
          controller.registerMonitor(monitor);
          this.context = context;
          HarmonySmartGestureHost.owner = this;
        } catch (_) { this.detach(); }
      }
    }
  }

  detach(): void {
    this.generation += 1;
    this.context = undefined;
    if (HarmonySmartGestureHost.owner === this) HarmonySmartGestureHost.owner = undefined;
    const release = this.release;
    this.release = undefined;
    release?.();
  }
}

export class ReaderSmartGestureShortcut implements AttributeModifier<CommonAttribute> {
  private readonly enabled: boolean;
  constructor(enabled: boolean) { this.enabled = enabled; }

  applyNormalAttribute(attribute: CommonAttribute): void {
    if (deviceInfo.distributionOSApiVersion >= 260000) {
      if (deviceInfo.apiAvailable('26.0.0')) {
        attribute.smartGestureShortcut({ enabled: this.enabled, selectable: false, action: GestureShortcut.PRIMARY });
      }
    }
  }
}
