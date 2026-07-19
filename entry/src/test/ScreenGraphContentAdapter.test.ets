import { describe, it, expect } from '@ohos/hypium';
import { RouteId } from '../main/ets/contract/generated/RouteTable';
import {
  ViewStateComponent,
  ViewStateExplicitBinding,
  ViewStateTable,
} from '../main/ets/contract/generated/ViewStateTable';
import {
  ReaderUIScreenGraphContentAdapter,
  ReaderUIScreenGraphContentProjection,
} from '../main/ets/ui/router/ReaderUIScreenGraphContentAdapter';

const ROUTES: RouteId[] = [
  'reader-replace-apply-result',
  'reader-replace-preview',
  'import-partial-success',
  'import-result-detail',
];
const CONTENT_IDS: string[] = [
  'reader_replace_apply_result-state',
  'reader_replace_preview-state',
  'import_partial_success-state',
  'import_result_detail-state',
];

function componentById(components: ViewStateComponent[], id: string): ViewStateComponent | null {
  for (let index: number = 0; index < components.length; index += 1) {
    const component: ViewStateComponent = components[index];
    if (component.id === id) return component;
    const nested: ViewStateComponent | null = componentById(component.children, id);
    if (nested !== null) return nested;
  }
  return null;
}

function canonicalContent(index: number): ViewStateComponent {
  const component: ViewStateComponent | null = componentById(
    ViewStateTable.componentsFor(ROUTES[index], 'default'),
    CONTENT_IDS[index],
  );
  return component ?? { type: '', id: '', props: {}, children: [], bindings: [] };
}

function copyContent(component: ViewStateComponent): ViewStateComponent {
  return {
    type: component.type,
    id: component.id,
    props: {
      title: component.props.title,
      message: component.props.message,
      uiEvent: component.props.uiEvent,
      uiEventPayload: component.props.uiEventPayload,
      uiEventTrigger: component.props.uiEventTrigger,
    },
    children: [],
    bindings: [],
  };
}

export default function ScreenGraphContentAdapterTests(): void {
  describe('ScreenGraphContentAdapter', () => {
    it('projectsAllFourCanonicalLeafStatesWithoutTurningEvidenceIntoAction', 0, () => {
      let stateEvidence: number = 0;
      for (let index: number = 0; index < ROUTES.length; index += 1) {
        const component: ViewStateComponent = canonicalContent(index);
        const projection: ReaderUIScreenGraphContentProjection | null =
          ReaderUIScreenGraphContentAdapter.project(component);
        expect(projection !== null).assertTrue();
        expect(projection!.title).assertEqual(component.props.title!);
        expect(projection!.message).assertEqual(component.props.message!);
        expect(component.children.length).assertEqual(0);
        expect(component.bindings.length).assertEqual(0);
        if (component.props.uiEventTrigger === 'state-evidence') stateEvidence += 1;
      }
      expect(stateEvidence).assertEqual(1);
    });

    it('rejectsUnknownPropsActionsChildrenBindingsAndMissingCopy', 0, () => {
      const canonical: ViewStateComponent = canonicalContent(0);

      const missingTitle: ViewStateComponent = copyContent(canonical);
      missingTitle.props.title = '';
      expect(ReaderUIScreenGraphContentAdapter.project(missingTitle) === null).assertTrue();

      const missingMessage: ViewStateComponent = copyContent(canonical);
      missingMessage.props.message = '';
      expect(ReaderUIScreenGraphContentAdapter.project(missingMessage) === null).assertTrue();

      const unknownProp: ViewStateComponent = copyContent(canonical);
      unknownProp.props.enabled = true;
      expect(ReaderUIScreenGraphContentAdapter.project(unknownProp) === null).assertTrue();

      const actionEvidence: ViewStateComponent = copyContent(canonical);
      actionEvidence.props.uiEvent = 'import.partial.success';
      actionEvidence.props.uiEventPayload = JSON.parse('{}') as Object;
      actionEvidence.props.uiEventTrigger = 'tap';
      expect(ReaderUIScreenGraphContentAdapter.project(actionEvidence) === null).assertTrue();

      const withChild: ViewStateComponent = copyContent(canonical);
      withChild.children = [{ type: 'Button', id: 'unexpected', props: {}, children: [], bindings: [] }];
      expect(ReaderUIScreenGraphContentAdapter.project(withChild) === null).assertTrue();

      const withBinding: ViewStateComponent = copyContent(canonical);
      const binding: ViewStateExplicitBinding = {
        target: 'self', event: 'button.activate', payload: {}, trigger: 'tap',
      };
      withBinding.bindings = [binding];
      expect(ReaderUIScreenGraphContentAdapter.project(withBinding) === null).assertTrue();
    });
  });
}
