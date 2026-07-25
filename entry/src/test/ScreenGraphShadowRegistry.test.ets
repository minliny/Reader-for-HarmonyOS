import { describe, it, expect } from '@ohos/hypium';
import {
  ScreenGraphCanonicalAsset,
  ScreenGraphRegistry,
} from '../main/ets/contract/reader_ui/ScreenGraph';
import {
  ViewStateComponent,
  ViewStateEntry,
  ViewStateJSONValue,
  ViewStateTable,
} from '../main/ets/contract/generated/ViewStateTable';
import {
  ReaderUIScreenGraphAuthority,
  ReaderUIScreenGraphShadowRegistry,
} from '../main/ets/ui/router/ReaderUIScreenGraphShadowRegistry';

function componentById(components: ViewStateComponent[], id: string): ViewStateComponent | undefined {
  for (let index = 0; index < components.length; index++) {
    const component: ViewStateComponent = components[index];
    if (component.id === id) return component;
    const nested: ViewStateComponent | undefined = componentById(component.children, id);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

export default function ScreenGraphShadowRegistryTests(): void {
  describe('ScreenGraphShadowRegistry', () => {
    it('loadsExactCanonicalIdentityAndCounts', 0, () => {
      expect(ScreenGraphCanonicalAsset.sha256)
        .assertEqual('bf17ea66c21c869b2f8207d252df58d5a727164a1f767ac1edd6eb18b55d851d');
      expect(ScreenGraphCanonicalAsset.routeCount).assertEqual(260);
      expect(ScreenGraphCanonicalAsset.variantCount).assertEqual(190);
      expect(ScreenGraphCanonicalAsset.componentCount).assertEqual(615);
      expect(ScreenGraphCanonicalAsset.bindingCount).assertEqual(97);
      expect(ScreenGraphCanonicalAsset.stateEventEvidenceCount).assertEqual(19);
      expect(ScreenGraphRegistry.loadCanonical().resolve('bookshelf').routeId).assertEqual('bookshelf');
    });

    it('observesRouteAndViewStateWithoutChangingAuthority', 0, () => {
      expect(ReaderUIScreenGraphShadowRegistry.AUTHORITY).assertEqual(ReaderUIScreenGraphAuthority.Shadow);
      expect(ReaderUIScreenGraphShadowRegistry.observeRoute('bookshelf', 'MainTabShell')).assertTrue();
      expect(ReaderUIScreenGraphShadowRegistry.routeMatched()).assertTrue();
      expect(ReaderUIScreenGraphShadowRegistry.observeViewState(
        'bookshelf',
        'default',
        ViewStateTable.componentsFor('bookshelf', 'default'),
      )).assertTrue();
      expect(ReaderUIScreenGraphShadowRegistry.viewStateMatched()).assertTrue();
      expect(ReaderUIScreenGraphShadowRegistry.observeRoute('not-a-route', null)).assertFalse();
    });

    it('keepsNestedContextAndPayloadAsLosslessJsonValues', 0, () => {
      let entry: ViewStateEntry | undefined = undefined;
      for (let index = 0; index < ViewStateTable.ENTRIES.length; index++) {
        const candidate: ViewStateEntry = ViewStateTable.ENTRIES[index];
        if (candidate.routeId === 'reader-theme-new') entry = candidate;
      }
      expect(entry !== undefined).assertTrue();
      const context: Record<string, ViewStateJSONValue> =
        ViewStateTable.contextFor('reader-theme-new', 'default');
      expect(context['bookId'] as string).assertEqual('bk-001');
      const button: ViewStateComponent | undefined = componentById(entry!.components, 'reader_theme_new-confirm');
      expect(button !== undefined).assertTrue();
      const payload = button!.props.uiEventPayload as Object as Record<string, Object>;
      const theme = payload['theme'] as Record<string, string>;
      expect(theme['id']).assertEqual('theme-custom-paper');
      expect(theme['background']).assertEqual('#F6F0E4');
    });
  });
}
