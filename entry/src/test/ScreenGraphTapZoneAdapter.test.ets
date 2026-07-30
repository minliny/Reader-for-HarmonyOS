import { describe, it, expect } from '@ohos/hypium';
import {
  ViewStateComponent,
  ViewStateExplicitBinding,
  ViewStateTable,
} from '../main/ets/contract/generated/ViewStateTable';
import {
  ReaderUIScreenGraphTapZoneAdapter,
  ReaderUIScreenGraphTapZoneTarget,
} from '../main/ets/ui/router/ReaderUIScreenGraphTapZoneAdapter';
import { UiEvent } from '../main/ets/ui/store/ReaderUiState';

function componentByType(components: ViewStateComponent[], type: string): ViewStateComponent | null {
  for (let index: number = 0; index < components.length; index += 1) {
    const component: ViewStateComponent = components[index];
    if (component.type === type) return component;
    const nested: ViewStateComponent | null = componentByType(component.children, type);
    if (nested !== null) return nested;
  }
  return null;
}

function tapZoneBindings(routeId: string, pageState: string): ViewStateExplicitBinding[] {
  const tapZones: ViewStateComponent | null = componentByType(
    ViewStateTable.componentsFor(routeId, pageState),
    'TapZones',
  );
  return tapZones === null ? [] : tapZones.bindings;
}

export default function ScreenGraphTapZoneAdapterTests(): void {
  describe('ScreenGraphTapZoneAdapter', () => {
    it('preservesTenExplicitTargetBindingsFromCanonicalViewState', 0, () => {
      const routes: string[] = [
        'reader-content-loading',
        'reader-content-offline',
        'reader-content-error',
        'reader-page-boundary-first',
        'reader-page-boundary-last',
      ];
      const pageStates: string[] = ['loading', 'offline', 'error', 'default', 'default'];
      let total: number = 0;
      let previous: number = 0;
      let control: number = 0;
      let next: number = 0;
      for (let index: number = 0; index < routes.length; index += 1) {
        const bindings: ViewStateExplicitBinding[] = tapZoneBindings(routes[index], pageStates[index]);
        total += bindings.length;
        for (let bindingIndex: number = 0; bindingIndex < bindings.length; bindingIndex += 1) {
          if (bindings[bindingIndex].target === 'previous') previous += 1;
          if (bindings[bindingIndex].target === 'control') control += 1;
          if (bindings[bindingIndex].target === 'next') next += 1;
        }
      }
      expect(total).assertEqual(10);
      expect(previous).assertEqual(3);
      expect(control).assertEqual(4);
      expect(next).assertEqual(3);
    });

    it('mapsOnlySupportedCanonicalTargetEventPairs', 0, () => {
      const bindings: ViewStateExplicitBinding[] = tapZoneBindings('reader-content-offline', 'offline');
      const previous: UiEvent | null = ReaderUIScreenGraphTapZoneAdapter.explicitEvent(bindings, 'previous');
      const control: UiEvent | null = ReaderUIScreenGraphTapZoneAdapter.explicitEvent(bindings, 'control');
      const next: UiEvent | null = ReaderUIScreenGraphTapZoneAdapter.explicitEvent(bindings, 'next');
      expect(previous !== null).assertTrue();
      expect(previous!.type).assertEqual('reader-page-prev');
      expect(control !== null).assertTrue();
      expect(control!.type).assertEqual('reader.control.toggle');
      expect(control!.readerUIJSONPayload?.['overlay']).assertEqual('reader-control');
      expect(next !== null).assertTrue();
      expect(next!.type).assertEqual('reader-page-next');
    });

    it('failsClosedForLoadingBoundariesAndMalformedBindings', 0, () => {
      const targets: ReaderUIScreenGraphTapZoneTarget[] = ['previous', 'control', 'next'];
      const loading: ViewStateExplicitBinding[] = tapZoneBindings('reader-content-loading', 'loading');
      for (let index: number = 0; index < targets.length; index += 1) {
        expect(ReaderUIScreenGraphTapZoneAdapter.explicitEvent(loading, targets[index]) === null).assertTrue();
      }
      expect(ReaderUIScreenGraphTapZoneAdapter.explicitEvent(
        tapZoneBindings('reader-page-boundary-first', 'default'),
        'previous',
      ) === null).assertTrue();
      expect(ReaderUIScreenGraphTapZoneAdapter.explicitEvent(
        tapZoneBindings('reader-page-boundary-last', 'default'),
        'next',
      ) === null).assertTrue();

      const malformed: ViewStateExplicitBinding[] = [{
        target: 'next',
        event: 'reader.page.prev',
        payload: {},
        trigger: 'tap',
      }];
      expect(ReaderUIScreenGraphTapZoneAdapter.explicitEvent(malformed, 'next') === null).assertTrue();
    });

    it('keepsLegacyImmersiveProductionFallbackStable', 0, () => {
      expect(ReaderUIScreenGraphTapZoneAdapter.productionEvent('previous').type).assertEqual('reader-page-prev');
      expect(ReaderUIScreenGraphTapZoneAdapter.productionEvent('control').type).assertEqual('reader.control.toggle');
      expect(ReaderUIScreenGraphTapZoneAdapter.productionEvent('control')
        .readerUIJSONPayload?.['overlay']).assertEqual('reader-control');
      expect(ReaderUIScreenGraphTapZoneAdapter.productionEvent('next').type).assertEqual('reader-page-next');
    });
  });
}
