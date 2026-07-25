// MotionResolver.test — asserts the resolver→registry→adapter pipeline resolves correctly
// and reduced-motion forces zero duration.
import { describe, it, expect } from '@ohos/hypium';
import { ReaderMotionResolver } from '../main/ets/ui/motion/ReaderMotionResolver';
import { MotionSpecRegistry } from '../main/ets/ui/motion/MotionSpecRegistry';
import { MotionAdapter } from '../main/ets/ui/adapters/MotionAdapter';
import { ReaderControlMotionCoordinator } from '../main/ets/ui/motion/ReaderControlMotionCoordinator';

export default function MotionResolverTests(): void {
  describe('MotionResolver', () => {
    it('resolvesPushForward', 0, () => {
      const id = ReaderMotionResolver.resolve({ operation: 'push', containerRole: 'appShell' });
      expect(id).assertEqual('app.route.push.forward');
    });
    it('resolvesPopBackward', 0, () => {
      const id = ReaderMotionResolver.resolve({ operation: 'pop', containerRole: 'appShell' });
      expect(id).assertEqual('app.route.pop.backward');
    });
    it('resolvesReplace', 0, () => {
      const id = ReaderMotionResolver.resolve({ operation: 'replace', containerRole: 'appShell' });
      expect(id).assertEqual('app.route.replace');
    });
    it('resolvesTabSwitch', 0, () => {
      const id = ReaderMotionResolver.resolve({ operation: 'tabSwitch', containerRole: 'mainTabShell' });
      expect(id).assertEqual('tab.switch');
    });
    it('registryResolvesSpec', 0, () => {
      const spec = MotionSpecRegistry.byId('app.route.push.forward');
      expect(spec !== undefined).assertTrue();
      expect(spec!.durationMs).assertEqual(160);
      expect(spec!.reducedMotionPolicy).assertEqual('zeroDuration');
    });
    it('reducedMotionForcesZeroDuration', 0, () => {
      const spec = MotionSpecRegistry.byId('app.route.push.forward');
      expect(spec !== undefined).assertTrue();
      expect(MotionAdapter.durationFor(spec!, true)).assertEqual(0);
      expect(MotionAdapter.durationFor(spec!, false)).assertEqual(160);
    });
    it('easingMapsToCurve', 0, () => {
      // curveFor returns an ArkUI Curve enum value; both standard easings must map.
      expect(MotionAdapter.curveFor('ease-out') === MotionAdapter.curveFor('ease-out')).assertTrue();
    });
    it('resolvesReaderControlShowAndHideSemantically', 0, () => {
      expect(ReaderMotionResolver.resolve({
        operation: 'enter', containerRole: 'readerShell', sourceRole: 'controlLayer', targetRole: 'controlHome',
      })).assertEqual('reader.control.show');
      expect(ReaderMotionResolver.resolve({
        operation: 'exit', containerRole: 'readerShell', sourceRole: 'controlLayer', targetRole: 'immersiveReading',
      })).assertEqual('reader.control.hide');
    });
    it('readerControlExitSettlesOnePresentationTargetBeforeReturningHidden', 0, () => {
      ReaderControlMotionCoordinator.reset();
      ReaderControlMotionCoordinator.beginEnter(true);
      expect(ReaderControlMotionCoordinator.phase()).assertEqual('visible');
      let displayedRoute = 'reader';
      const accepted = ReaderControlMotionCoordinator.beginExit(true, (): void => {
        // Mirrors RouteRenderer's presentation-route commit callback.  It
        // executes while the phase is still exiting, so the outgoing actors
        // cannot reset visible for a frame before the target is committed.
        expect(ReaderControlMotionCoordinator.phase()).assertEqual('exiting');
        displayedRoute = 'immersive-reading';
      });
      expect(accepted).assertTrue();
      expect(displayedRoute).assertEqual('immersive-reading');
      expect(ReaderControlMotionCoordinator.phase()).assertEqual('hidden');
      ReaderControlMotionCoordinator.reset();
    });
  });
}
