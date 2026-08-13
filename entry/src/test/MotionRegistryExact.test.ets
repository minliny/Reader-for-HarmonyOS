import { describe, it, expect } from '@ohos/hypium';
import { MotionPolicyTable } from '../main/ets/contract/generated/MotionPolicyTable';
import { MotionSpecRegistry } from '../main/ets/ui/motion/MotionSpecRegistry';
import { MotionSerialMetadataRegistry } from '../main/ets/ui/motion/MotionSerialMetadataRegistry';
import { ReaderMotionResolver } from '../main/ets/ui/motion/ReaderMotionResolver';

export default function MotionRegistryExactTests(): void {
  describe('MotionRegistryExact', () => {
    it('derivesAll95SerialMetadataRecordsFromGeneratedSpecs', 0, () => {
      const specs = MotionSpecRegistry.all();
      const metadata = MotionSerialMetadataRegistry.all();
      expect(specs.length).assertEqual(95);
      expect(metadata.length).assertEqual(95);

      const seen: string[] = [];
      for (let index = 0; index < specs.length; index++) {
        const spec = specs[index];
        expect(seen.indexOf(spec.id)).assertEqual(-1);
        seen.push(spec.id);
        expect(metadata[index].serialName).assertEqual(spec.id);
        expect(metadata[index].durationMs).assertEqual(spec.durationMs);
        expect(metadata[index].operation).assertEqual(spec.operation);
        expect(metadata[index].containerRole).assertEqual(spec.containerRole);
        expect(metadata[index].interruptPolicy).assertEqual(spec.interruptPolicy);
        expect(metadata[index].reducedMotionPolicy).assertEqual(spec.reducedMotionPolicy);
      }
    });

    it('everyPolicyReferencesGeneratedMotionSpec', 0, () => {
      for (let index = 0; index < MotionPolicyTable.POLICIES.length; index++) {
        expect(MotionSpecRegistry.has(MotionPolicyTable.POLICIES[index].motionId)).assertTrue();
      }
    });

    it('all89ActiveSpecsCarryExactStateMachinesAndOnlySixNonProductionIdsAreExempt', 0, () => {
      const nonProductionIds: string[] = [
        'reader.sourceSwitch.open-close',
        'reader.session.controlSpace.enter',
        'reader.session.controlSpace.exit',
        'overlay.dialog.enter-exit',
        'overlay.sheet.enter-exit',
        'reader.session.controlSpace.update',
      ];
      const deprecatedIds: string[] = [
        'reader.sourceSwitch.open-close',
        'overlay.dialog.enter-exit',
        'overlay.sheet.enter-exit',
      ];
      let exactCount: number = 0;
      let pendingCount: number = 0;
      const specs = MotionSpecRegistry.all();
      for (let index = 0; index < specs.length; index++) {
        const spec = specs[index];
        const exact: boolean = spec.trigger !== undefined && spec.trigger.length > 0 &&
          spec.from !== undefined && spec.from.length > 0 &&
          spec.to !== undefined && spec.to.length > 0 &&
          spec.interrupt !== undefined && spec.interrupt.length > 0 &&
          spec.finalState !== undefined && spec.finalState.length > 0 &&
          spec.cleanup !== undefined && spec.cleanup.length > 0;
        if (exact) {
          exactCount += 1;
          expect(nonProductionIds.indexOf(spec.id)).assertEqual(-1);
        } else {
          pendingCount += 1;
          expect(nonProductionIds.indexOf(spec.id) >= 0).assertTrue();
        }
        if (deprecatedIds.indexOf(spec.id) >= 0) {
          expect(spec.deprecated).assertTrue();
        }
      }
      expect(exactCount).assertEqual(89);
      expect(pendingCount).assertEqual(6);
    });

    it('serialLookupIsExactWithoutUnknownCatchAll', 0, () => {
      const metadata = MotionSerialMetadataRegistry.bySerialName('reader.page.turn.next-prev');
      expect(metadata !== undefined).assertTrue();
      expect(metadata!.implementationKind).assertEqual('readerPageTurn');
      expect(MotionSerialMetadataRegistry.bySerialName('unknown.motion') === undefined).assertTrue();
      expect(ReaderMotionResolver.resolve({ operation: 'unknown', containerRole: 'unknown' }) === undefined).assertTrue();
    });
  });
}
