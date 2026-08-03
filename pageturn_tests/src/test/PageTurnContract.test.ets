import { describe, it, expect } from '@ohos/hypium';
import { PageTurnContract, PageTurnModeId, PageTurnCapabilityId } from 'pageturn';

// ArkTS forbids nested functions, so capability assertions live at module scope.
function assertCapability(modeId: PageTurnModeId, expected: PageTurnCapabilityId | undefined): void {
  const actual = PageTurnContract.requiredCapabilityFor(modeId);
  if (expected === undefined) {
    expect(actual === undefined).assertTrue();
  } else {
    expect(actual).assertEqual(expected);
  }
}

// PageTurnContract acceptance + contract-drift guard.
//
// This proves the HarmonyOS side actually consumes the upstream PageTurn v2
// contract (not just that Motion.ets compiles): the synced artifact must be
// readable and must carry the exact structural values the coordinator and
// providers depend on. Any upstream change to these pinned values fails here
// before it can silently drift into the page-turn subsystem.
//
// These are contract-shape assertions only. Behavioral cases (half-drag cancel,
// lease loss/revoke, reorder recovery) live with the coordinator/providers.
export default function PageTurnContractTests(): void {
  describe('PageTurnContract', () => {
    it('syncedContractIsPresentAndPinnedToVersion2', 0, () => {
      expect(PageTurnContract.isContractPresent()).assertTrue();
      const c = PageTurnContract.contract();
      expect(c !== undefined).assertTrue();
      expect(c!.contractVersion).assertEqual(2);
      expect(c!.contractStatus).assertEqual('source-traced-engineering-profile-ready');
      expect(PageTurnContract.liveDesignRead()).assertEqual('figma-page-25-motion-timelines-read');
    });

    it('authorizesExactlyFiveModesInContractOrder', 0, () => {
      const expected: PageTurnModeId[] = ['cover', 'slide', 'simulation', 'scroll', 'none'];
      const ids = PageTurnContract.modeIds();
      expect(ids.length).assertEqual(expected.length);
      for (let i = 0; i < expected.length; i++) {
        expect(ids[i]).assertEqual(expected[i]);
      }
    });

    it('simulationRequiresReal3dAndScrollRequiresAnchorCommit', 0, () => {
      assertCapability('simulation', 'reader.page.turn.real3d.v1');
      assertCapability('scroll', 'reader.scroll.anchor-commit.v1');
    });

    it('coverSlideNoneAreForbiddenFromDeclaringAnyCapability', 0, () => {
      assertCapability('cover', undefined);
      assertCapability('slide', undefined);
      assertCapability('none', undefined);
    });

    it('capabilitiesFailClosedWhenProviderIsMissing', 0, () => {
      expect(PageTurnContract.unsupportedCapabilityFor('simulation'))
        .assertEqual('fail-closed-no-2d-fallback');
      expect(PageTurnContract.unsupportedCapabilityFor('scroll'))
        .assertEqual('fail-closed-no-local-scroll-commit');
      // cover/slide/none have no capability and thus no fail-closed behavior.
      expect(PageTurnContract.unsupportedCapabilityFor('cover') === undefined).assertTrue();
      expect(PageTurnContract.unsupportedCapabilityFor('none') === undefined).assertTrue();
    });

    it('reverseMapsCapabilityToOwningMode', 0, () => {
      expect(PageTurnContract.modeIdForCapability('reader.page.turn.real3d.v1'))
        .assertEqual('simulation');
      expect(PageTurnContract.modeIdForCapability('reader.scroll.anchor-commit.v1'))
        .assertEqual('scroll');
    });

    it('visibleCommitIsGatedOnCoreStoredTrue', 0, () => {
      const tx = PageTurnContract.transaction();
      expect(tx !== undefined).assertTrue();
      expect(tx!.visibleCommit).assertEqual('after-reader.progress.update-stored-true');
      expect(tx!.failure).assertEqual('restore-last-committed');
      expect(tx!.interrupt).assertEqual('cancel-before-persisting-progress-only');
    });

    it('stateMachineOnlyReachesStableAfterStored', 0, () => {
      const sm = PageTurnContract.stateMachine();
      expect(sm !== undefined).assertTrue();
      const expectedStates: string[] =
        ['idle', 'prepared', 'preview', 'awaiting-stored', 'settling', 'stable', 'rollback'];
      expect(sm!.states.length).assertEqual(expectedStates.length);
      for (let i = 0; i < expectedStates.length; i++) {
        expect(sm!.states[i]).assertEqual(expectedStates[i]);
      }
      expect(sm!.stable).assertEqual('after-reader.progress.update-stored-true');
      expect(sm!.rollback).assertEqual('restore-last-committed');
    });

    it('parentPresentationFallbackAndCapabilityInjectionAreForbidden', 0, () => {
      expect(PageTurnContract.parentPresentationFallback()).assertEqual('forbidden');
      const reg = PageTurnContract.capabilityRegistration();
      expect(reg !== undefined).assertTrue();
      expect(reg!.uiCapabilityInjection).assertEqual('forbidden');
    });

    it('uiMayOnlyPassModeIdDirectionAndRawPointer', 0, () => {
      const expected: string[] = ['modeId', 'direction', 'rawPointer'];
      const fields = PageTurnContract.uiIntentFields();
      expect(fields.length).assertEqual(expected.length);
      for (let i = 0; i < expected.length; i++) {
        expect(fields[i]).assertEqual(expected[i]);
      }
    });

    it('eachModeDeclaresItsContractedRenderer', 0, () => {
      expect(PageTurnContract.runtimeModeFor('cover')!.renderer).assertEqual('two-live-page-surface');
      expect(PageTurnContract.runtimeModeFor('slide')!.renderer).assertEqual('two-live-page-surface');
      expect(PageTurnContract.runtimeModeFor('simulation')!.renderer).assertEqual('real3d-live-page-surface');
      expect(PageTurnContract.runtimeModeFor('scroll')!.renderer).assertEqual('native-continuous-scroll');
      expect(PageTurnContract.runtimeModeFor('none')!.renderer).assertEqual('instant-live-page-swap');
    });
  });
}
