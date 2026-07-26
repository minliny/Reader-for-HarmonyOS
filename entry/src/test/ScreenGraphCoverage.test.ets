import { describe, it, expect } from '@ohos/hypium';
import { ReaderUIScreenGraphAuthority } from '../main/ets/ui/router/ReaderUIScreenGraphShadowRegistry';
import {
  READER_SCREEN_GRAPH_DIALOG_GENERIC_BLOCKER,
  ReaderUIScreenGraphComponentCoverage,
  ReaderUIScreenGraphCoverageRegistry,
} from '../main/ets/ui/router/ReaderUIScreenGraphCoverage';

export default function ScreenGraphCoverageTests(): void {
  describe('ScreenGraphCoverage', () => {
    it('partitionsCanonicalRendererCoverageWithoutPromotingShadowAuthority', 0, () => {
      const coverage: ReaderUIScreenGraphComponentCoverage =
        ReaderUIScreenGraphCoverageRegistry.loadCanonical();

      expect(coverage.authority).assertEqual(ReaderUIScreenGraphAuthority.Shadow);
      expect(coverage.canonicalComponentCount).assertEqual(174);
      expect(coverage.referencedTypes.length).assertEqual(138);
      expect(coverage.explicitGapTypes.length).assertEqual(36);
      expect(coverage.explicitDispatchTypes.length).assertEqual(138);
      expect(coverage.hostCompositeTypes.join('|'))
        .assertEqual('TapZones|ReaderBase|ReaderTopArea|ReaderBottomBar');

      expect(coverage.faithfulTypes.length).assertEqual(72);
      expect(coverage.genericUsableTypes.length).assertEqual(59);
      expect(coverage.partialTypes.length).assertEqual(3);
      expect(coverage.insufficientTypes.length).assertEqual(0);
      expect(coverage.figmaUnboundStateTypes.join('|'))
        .assertEqual('Loading|Empty|ErrorState|Offline');
      expect(coverage.visibleFailureTypes.length).assertEqual(3);
      expect(coverage.genericUsableTypes.indexOf('ReaderDirectoryPanel') >= 0).assertTrue();
      expect(coverage.genericUsableTypes.indexOf('ReaderAppearancePanel') >= 0).assertTrue();
      expect(coverage.genericUsableTypes.indexOf('ReaderReplacePanel') >= 0).assertTrue();
      expect(coverage.genericUsableTypes.indexOf('SourceSwitchFlowPage') >= 0).assertTrue();
      expect(coverage.genericUsableTypes.indexOf('SourceSwitchResultsPanel')).assertEqual(-1);
      expect(coverage.faithfulTypes.indexOf('RestoreConfirmPage')).assertEqual(-1);
      expect(coverage.faithfulTypes.indexOf('RestoreProgressPage')).assertEqual(-1);
      expect(coverage.faithfulTypes.indexOf('RestoreConflictPage')).assertEqual(-1);
      expect(coverage.faithfulTypes.indexOf('RestoreResultPage')).assertEqual(-1);
      expect(coverage.genericUsableTypes.indexOf('ReadingTextFlow') >= 0).assertTrue();
      // Button stays generic until every canonical binding has an exact
      // Host/reducer/runtime owner. The current adapter intentionally admits
      // only four source.import.open actions and keeps all 3.0 additions inert.
      expect(coverage.genericUsableTypes.indexOf('Button') >= 0).assertTrue();
      expect(coverage.faithfulTypes.indexOf('Button')).assertEqual(-1);
      expect(coverage.genericUsableTypes.indexOf('Dialog') >= 0).assertTrue();
      expect(coverage.faithfulTypes.indexOf('Dialog')).assertEqual(-1);
      expect(READER_SCREEN_GRAPH_DIALOG_GENERIC_BLOCKER).assertEqual(
        '5 executable nested Button bindings remain inert: reader.font.import, reader.font.delete, reader.theme.delete, reader.typography.reset, reader.progress.restore',
      );
      expect(coverage.genericUsableTypes.indexOf('Content') >= 0).assertTrue();
      expect(coverage.faithfulTypes.indexOf('Content')).assertEqual(-1);
      expect(coverage.figmaUnboundStateTypes.indexOf('Empty') >= 0).assertTrue();
      expect(coverage.genericUsableTypes.indexOf('Empty')).assertEqual(-1);
      expect(coverage.faithfulTypes.indexOf('Error') >= 0).assertTrue();
      expect(coverage.faithfulTypes.indexOf('Permission') >= 0).assertTrue();
      expect(coverage.genericUsableTypes.indexOf('Error')).assertEqual(-1);
      expect(coverage.genericUsableTypes.indexOf('Permission')).assertEqual(-1);
      expect(coverage.figmaUnboundStateTypes.indexOf('Loading') >= 0).assertTrue();
      expect(coverage.figmaUnboundStateTypes.indexOf('ErrorState') >= 0).assertTrue();
      expect(coverage.figmaUnboundStateTypes.indexOf('Offline') >= 0).assertTrue();
      expect(coverage.faithfulTypes.indexOf('Loading')).assertEqual(-1);
      expect(coverage.faithfulTypes.indexOf('Empty')).assertEqual(-1);
      expect(coverage.faithfulTypes.indexOf('ErrorState')).assertEqual(-1);
      expect(coverage.faithfulTypes.indexOf('Offline')).assertEqual(-1);
      expect(coverage.genericUsableTypes.indexOf('Loading')).assertEqual(-1);
      expect(coverage.genericUsableTypes.indexOf('ErrorState')).assertEqual(-1);
      expect(coverage.genericUsableTypes.indexOf('Offline')).assertEqual(-1);

      expect(coverage.canonicalInstanceCount).assertEqual(615);
      // runtimeActiveInstanceCount / retiredInstanceCount were tracked by the
      // deleted parallel admission policy; the canonical count above already
      // covers the total. The decomposition is not re-tracked here.
      expect(coverage.faithfulInstanceCount).assertEqual(293);
      expect(coverage.hostCompositeInstanceCount).assertEqual(115);
      expect(coverage.genericUsableInstanceCount).assertEqual(250);
      expect(coverage.partialInstanceCount).assertEqual(52);
      expect(coverage.insufficientInstanceCount).assertEqual(0);
      expect(coverage.figmaUnboundStateInstanceCount).assertEqual(20);
      expect(coverage.explicitTargetBindingCount).assertEqual(97);
      expect(coverage.tapZoneExplicitTargetBindingCount).assertEqual(16);

      expect(coverage.isAdapterRegistryClosed).assertFalse();
      expect(coverage.isFullRenderer).assertFalse();
    });

    it('keepsHighFrequencyDataDroppingBranchesVisible', 0, () => {
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('ReaderBase')).assertEqual(
        '49 host-composite instances retain Core/Host authority for live theme, text/info, pagination/anchor, and composite controls; 2 planned document formats stay fail-closed',
      );
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('BookshelfEmptyPage')).assertEqual(
        'the historical generated title/message fixture is intentionally not projected; current Figma State/BookshelfEmpty owns the exact visible component and its two crosswalk-bound actions',
      );
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('ReadingTextFlow') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('ReaderDirectoryPanel') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('ReaderAppearancePanel') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('ReaderReplacePanel') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('SourceSwitchFlowPage') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('BackTopBar') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('AppTopBar') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('BottomNav') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('ReadingBackgroundLayer') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('ReadingInfoLayer') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('TapZones') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('BookGrid') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('FormSection') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('SourceRuleEditPage') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('SourceImportOptionsPage') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('SettingsGeneralPage') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('SourceManagementPage') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('SyncProgressPage') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('RssDetailPage') === undefined).assertTrue();
      expect(ReaderUIScreenGraphCoverageRegistry.partialReason('ReaderFullAppearancePage') === undefined).assertTrue();
    });
  });
}
