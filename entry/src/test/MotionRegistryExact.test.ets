import { describe, it, expect } from '@ohos/hypium';
import { MotionPolicyTable } from '../main/ets/contract/generated/MotionPolicyTable';
import { MotionSpecRegistry } from '../main/ets/ui/motion/MotionSpecRegistry';
import { MotionSerialMetadataRegistry } from '../main/ets/ui/motion/MotionSerialMetadataRegistry';
import { ReaderMotionResolver } from '../main/ets/ui/motion/ReaderMotionResolver';

export default function MotionRegistryExactTests(): void {
  describe('MotionRegistryExact', () => {
    it('derivesAll93SerialMetadataRecordsFromGeneratedSpecs', 0, () => {
      const specs = MotionSpecRegistry.all();
      const metadata = MotionSerialMetadataRegistry.all();
      expect(specs.length).assertEqual(93);
      expect(metadata.length).assertEqual(93);

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

    it('serialLookupIsExactWithoutUnknownCatchAll', 0, () => {
      const metadata = MotionSerialMetadataRegistry.bySerialName('reader.page.turn.next-prev');
      expect(metadata !== undefined).assertTrue();
      expect(metadata!.implementationKind).assertEqual('readerPageTurn');
      expect(MotionSerialMetadataRegistry.bySerialName('unknown.motion') === undefined).assertTrue();
      expect(ReaderMotionResolver.resolve({ operation: 'unknown', containerRole: 'unknown' }) === undefined).assertTrue();
    });
  });
}
