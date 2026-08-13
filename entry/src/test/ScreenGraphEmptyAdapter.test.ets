import { describe, it, expect } from '@ohos/hypium';
import { RouteId } from '../main/ets/contract/generated/RouteTable';
import {
  ViewStateComponent,
  ViewStateExplicitBinding,
  ViewStateTable,
} from '../main/ets/contract/generated/ViewStateTable';
import {
  ReaderUIScreenGraphEmptyAdapter,
  ReaderUIScreenGraphEmptyProjection,
} from '../main/ets/ui/router/ReaderUIScreenGraphEmptyAdapter';

const ROUTES: RouteId[] = ['source-switch-empty', 'import-empty-file'];
const PAGE_STATES: string[] = ['empty', 'empty'];
const EMPTY_IDS: string[] = ['source_switch_empty-state', 'import_empty_file-state'];
const EXPECTED_EVENTS: string[] = ['source.switch.empty', 'import.file.empty'];

function componentById(components: ViewStateComponent[], id: string): ViewStateComponent | null {
  for (let index: number = 0; index < components.length; index += 1) {
    const component: ViewStateComponent = components[index];
    if (component.id === id) return component;
    const nested: ViewStateComponent | null = componentById(component.children, id);
    if (nested !== null) return nested;
  }
  return null;
}

function canonicalEmpty(index: number): ViewStateComponent {
  const component: ViewStateComponent | null = componentById(
    ViewStateTable.componentsFor(ROUTES[index], PAGE_STATES[index]),
    EMPTY_IDS[index],
  );
  return component ?? { type: '', id: '', props: {}, children: [], bindings: [] };
}

function copyEmpty(component: ViewStateComponent): ViewStateComponent {
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

export default function ScreenGraphEmptyAdapterTests(): void {
  describe('ScreenGraphEmptyAdapter', () => {
    it('projectsBothCanonicalEmptyLeavesWithoutTurningEvidenceIntoAction', 0, () => {
      for (let index: number = 0; index < ROUTES.length; index += 1) {
        const component: ViewStateComponent = canonicalEmpty(index);
        const projection: ReaderUIScreenGraphEmptyProjection | null =
          ReaderUIScreenGraphEmptyAdapter.project(component);
        expect(projection !== null).assertTrue();
        expect(projection!.title).assertEqual(component.props.title!);
        expect(projection!.message).assertEqual(component.props.message!);
        expect(component.props.uiEvent).assertEqual(EXPECTED_EVENTS[index]);
        expect(component.props.uiEventTrigger).assertEqual('state-evidence');
        expect(component.children.length).assertEqual(0);
        expect(component.bindings.length).assertEqual(0);
      }
    });

    it('rejectsMissingTextActionLabelsTapTriggersChildrenAndBindings', 0, () => {
      const canonical: ViewStateComponent = canonicalEmpty(0);

      const missingTitle: ViewStateComponent = copyEmpty(canonical);
      missingTitle.props.title = '';
      expect(ReaderUIScreenGraphEmptyAdapter.project(missingTitle) === null).assertTrue();

      const missingMessage: ViewStateComponent = copyEmpty(canonical);
      missingMessage.props.message = '';
      expect(ReaderUIScreenGraphEmptyAdapter.project(missingMessage) === null).assertTrue();

      const actionLabel: ViewStateComponent = copyEmpty(canonical);
      actionLabel.props.action = '重新选择';
      expect(ReaderUIScreenGraphEmptyAdapter.project(actionLabel) === null).assertTrue();

      const tapEvidence: ViewStateComponent = copyEmpty(canonical);
      tapEvidence.props.uiEventTrigger = 'tap';
      expect(ReaderUIScreenGraphEmptyAdapter.project(tapEvidence) === null).assertTrue();

      const withChild: ViewStateComponent = copyEmpty(canonical);
      const unexpectedChild: ViewStateComponent = {
        type: 'Button', id: 'unexpected', props: {}, children: [], bindings: [],
      };
      withChild.children = [unexpectedChild];
      expect(ReaderUIScreenGraphEmptyAdapter.project(withChild) === null).assertTrue();

      const withBinding: ViewStateComponent = copyEmpty(canonical);
      const binding: ViewStateExplicitBinding = {
        target: 'self', event: 'button.activate', payload: {}, trigger: 'tap',
      };
      withBinding.bindings = [binding];
      expect(ReaderUIScreenGraphEmptyAdapter.project(withBinding) === null).assertTrue();
    });
  });
}
