import { describe, it, expect } from '@ohos/hypium';
import { RouteTable } from '../main/ets/contract/generated/RouteTable';
import { ViewStateTable } from '../main/ets/contract/generated/ViewStateTable';
import {
  Contract25RouteAvailability,
  Contract25RouteRendererKind,
  ReaderContract25RouteRegistry,
} from '../main/ets/ui/router/ReaderContract25RouteRegistry';

export default function Contract25RouteRegistryTests(): void {
  describe('Contract25RouteRegistry', () => {
    it('matchesCanonical260AndExact35HistoricalAdditions', 0, () => {
      expect(RouteTable.ALL.length).assertEqual(260);
      expect(ReaderContract25RouteRegistry.ALL.length).assertEqual(35);

      const seen: string[] = [];
      for (let index = 0; index < ReaderContract25RouteRegistry.ALL.length; index++) {
        const definition = ReaderContract25RouteRegistry.ALL[index];
        expect(RouteTable.has(definition.id)).assertTrue();
        expect(RouteTable.shellOf(definition.id)).assertEqual(definition.shell);
        expect(seen.indexOf(definition.id)).assertEqual(-1);
        seen.push(definition.id);
      }
    });

    it('everyHistoricalAdditionHasDirectCanonicalViewState', 0, () => {
      for (let index = 0; index < ReaderContract25RouteRegistry.ALL.length; index++) {
        const definition = ReaderContract25RouteRegistry.ALL[index];
        const components = ViewStateTable.componentsFor(definition.id, 'default');
        expect(components.length > 0).assertTrue();
      }
    });

    it('all260RoutesResolveAConcreteViewState', 0, () => {
      for (let index = 0; index < RouteTable.ALL.length; index++) {
        expect(ViewStateTable.componentsFor(RouteTable.ALL[index], 'default').length > 0).assertTrue();
      }
    });

    it('legacyFallbackRegistryRemainsNonExecutable', 0, () => {
      for (let index = 0; index < ReaderContract25RouteRegistry.ALL.length; index++) {
        const definition = ReaderContract25RouteRegistry.ALL[index];
        expect(definition.title.length > 0).assertTrue();
        expect(definition.availability).assertEqual(Contract25RouteAvailability.LegacyUnavailable);
      }
    });

    it('keyRoutesSelectExplicitNativeRendererFamilies', 0, () => {
      expect(ReaderContract25RouteRegistry.byId('reader-font-import-confirm')!.renderer)
        .assertEqual(Contract25RouteRendererKind.ReaderWorkspaceState);
      expect(ReaderContract25RouteRegistry.byId('reader-replace-page')!.renderer)
        .assertEqual(Contract25RouteRendererKind.ReaderReplacementState);
      expect(ReaderContract25RouteRegistry.byId('source-switch-preview')!.renderer)
        .assertEqual(Contract25RouteRendererKind.SourceSwitchState);
      expect(ReaderContract25RouteRegistry.byId('reader-content-error')!.renderer)
        .assertEqual(Contract25RouteRendererKind.ReaderContentState);
      expect(ReaderContract25RouteRegistry.byId('import-conflict-resolve')!.renderer)
        .assertEqual(Contract25RouteRendererKind.LocalImportState);
      expect(ReaderContract25RouteRegistry.byId('not-a-route') === undefined).assertTrue();
      expect(RouteTable.shellOf('not-a-route') === null).assertTrue();
    });
  });
}
