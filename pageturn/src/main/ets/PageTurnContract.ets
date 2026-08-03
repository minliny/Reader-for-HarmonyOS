// PageTurnContract - host-private read surface for the Reader-UI PageTurn v2
// contract (the `pageTurn` block on `reader.page.turn.next-prev`).
//
// This is the SINGLE place the HarmonyOS page-turn subsystem reads the contract.
// The synced contract artifact lives at ./contract/Motion.ets
// (produced by Reader-UI tools/codegen/generate.mjs, copied verbatim by
// scripts/gen_contracts.mjs). Reading it here - rather than each consumer
// reaching into the fixture - means contract drift is caught at one boundary
// and no consumer invents visual/motion/lease parameters of its own.
//
// This file adds NO contract values. It only exposes what the upstream
// contract already carries, plus pure derivations (modeId <-> capability).
import { getMotionSpec, MotionId, MotionPageTurn, MotionPageTurnRuntimeMode,
  MotionPageTurnEngineeringProfile, MotionPageTurnCapabilityRegistration,
  MotionPageTurnCapabilityDefinition, MotionPageTurnEngineeringTransaction,
  MotionPageTurnEngineeringStateMachine, MotionPageTurnRuntimeGesture,
  MotionPageTurnRuntimeSettle, MotionPageTurnScrollPersistence,
  MotionPageTurnEngineeringShared } from './contract/Motion';

// The contract pins pageTurn to exactly one MotionId; the allOf in
// motion.schema.json makes it required here and forbidden elsewhere.
const PAGE_TURN_MOTION_ID: MotionId = 'reader.page.turn.next-prev';

// The five mode ids the contract authorizes. Mirrored as a closed type so a
// provider/coordinator cannot admit a sixth mode the contract does not carry.
export type PageTurnModeId = 'cover' | 'slide' | 'simulation' | 'scroll' | 'none';

// The two provider capabilities the contract admits. cover/slide/none are
// explicitly forbidden from declaring any capability (motion.schema.json
// allOf), so they never appear here.
export type PageTurnCapabilityId =
  | 'reader.page.turn.real3d.v1'
  | 'reader.scroll.anchor-commit.v1';

export class PageTurnContract {
  /** True only when the synced contract is present and pinned to version 2. */
  static isContractPresent(): boolean {
    const c = PageTurnContract.contract();
    return c !== undefined && c.contractVersion === 2;
  }

  /** The raw pageTurn contract object; undefined if the artifact is missing. */
  static contract(): MotionPageTurn | undefined {
    const spec = getMotionSpec(PAGE_TURN_MOTION_ID);
    if (spec === undefined) return undefined;
    return spec.pageTurn;
  }

  static engineeringProfile(): MotionPageTurnEngineeringProfile | undefined {
    return PageTurnContract.contract()?.engineeringProfile;
  }

  /** The lease / Core-progress / loss contract for providers + coordinator. */
  static capabilityRegistration(): MotionPageTurnCapabilityRegistration | undefined {
    return PageTurnContract.engineeringProfile()?.capabilityRegistration;
  }

  static shared(): MotionPageTurnEngineeringShared | undefined {
    return PageTurnContract.engineeringProfile()?.shared;
  }

  /** visibleCommit / failure / interrupt / semanticEvents. */
  static transaction(): MotionPageTurnEngineeringTransaction | undefined {
    return PageTurnContract.shared()?.transaction;
  }

  /** idle -> prepared -> preview -> awaiting-stored -> settling -> stable (+ rollback). */
  static stateMachine(): MotionPageTurnEngineeringStateMachine | undefined {
    return PageTurnContract.shared()?.stateMachine;
  }

  /** Must be 'forbidden'; a mode may never fall back to the parent 220ms spec. */
  static parentPresentationFallback(): string | undefined {
    return PageTurnContract.shared()?.parentPresentationFallback;
  }

  /** The only fields UI/settings may pass to a provider; capability injection is forbidden. */
  static uiIntentFields(): string[] {
    return PageTurnContract.capabilityRegistration()?.uiIntentFields ?? [];
  }

  /** The five runtime modes (renderer / settle / gesture / capability per mode). */
  static runtimeModes(): MotionPageTurnRuntimeMode[] {
    return PageTurnContract.engineeringProfile()?.modes ?? [];
  }

  static runtimeModeFor(modeId: PageTurnModeId): MotionPageTurnRuntimeMode | undefined {
    const modes = PageTurnContract.runtimeModes();
    for (let i = 0; i < modes.length; i++) {
      if (modes[i].id === modeId) return modes[i];
    }
    return undefined;
  }

  static runtimeGesture(modeId: PageTurnModeId): MotionPageTurnRuntimeGesture | undefined {
    return PageTurnContract.runtimeModeFor(modeId)?.gesture;
  }

  static runtimeSettle(modeId: PageTurnModeId): MotionPageTurnRuntimeSettle | undefined {
    return PageTurnContract.runtimeModeFor(modeId)?.settle;
  }

  static scrollPersistence(modeId: PageTurnModeId): MotionPageTurnScrollPersistence | undefined {
    return PageTurnContract.runtimeModeFor(modeId)?.scrollPersistence;
  }

  /** The capability a mode requires (simulation -> real3d, scroll -> anchor-commit). */
  static requiredCapabilityFor(modeId: PageTurnModeId): PageTurnCapabilityId | undefined {
    const raw = PageTurnContract.runtimeModeFor(modeId)?.requiredCapability;
    if (raw === undefined) return undefined;
    return PageTurnContract.asCapabilityId(raw);
  }

  /** The fail-closed behavior a mode declares when its capability is missing. */
  static unsupportedCapabilityFor(modeId: PageTurnModeId): string | undefined {
    return PageTurnContract.runtimeModeFor(modeId)?.unsupportedCapability;
  }

  static capabilityDefinitions(): MotionPageTurnCapabilityDefinition[] {
    return PageTurnContract.capabilityRegistration()?.capabilities ?? [];
  }

  static capabilityDefinitionFor(
    capability: PageTurnCapabilityId,
  ): MotionPageTurnCapabilityDefinition | undefined {
    const defs = PageTurnContract.capabilityDefinitions();
    for (let i = 0; i < defs.length; i++) {
      if (defs[i].capability === capability) return defs[i];
    }
    return undefined;
  }

  /** Reverse map: which mode requires this capability. */
  static modeIdForCapability(capability: PageTurnCapabilityId): PageTurnModeId | undefined {
    const modes = PageTurnContract.runtimeModes();
    for (let i = 0; i < modes.length; i++) {
      if (modes[i].requiredCapability === capability) {
        return PageTurnContract.asModeId(modes[i].id);
      }
    }
    return undefined;
  }

  /** The five mode ids the contract authorizes, in contract order. */
  static modeIds(): PageTurnModeId[] {
    const modes = PageTurnContract.runtimeModes();
    const ids: PageTurnModeId[] = [];
    for (let i = 0; i < modes.length; i++) {
      const id = PageTurnContract.asModeId(modes[i].id);
      if (id !== undefined) ids.push(id);
    }
    return ids;
  }

  /** 'figma-page-25-motion-timelines-read' when the live-design boundary was read. */
  static liveDesignRead(): string | undefined {
    return PageTurnContract.contract()?.sourceBoundary.liveDesignRead;
  }

  private static asModeId(raw: string): PageTurnModeId | undefined {
    if (raw === 'cover' || raw === 'slide' || raw === 'simulation' ||
      raw === 'scroll' || raw === 'none') {
      return raw;
    }
    return undefined;
  }

  private static asCapabilityId(raw: string): PageTurnCapabilityId | undefined {
    if (raw === 'reader.page.turn.real3d.v1' || raw === 'reader.scroll.anchor-commit.v1') {
      return raw;
    }
    return undefined;
  }
}
