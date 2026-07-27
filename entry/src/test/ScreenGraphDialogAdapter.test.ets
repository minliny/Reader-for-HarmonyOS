import { describe, it, expect } from '@ohos/hypium';
import { RouteId } from '../main/ets/contract/generated/RouteTable';
import {
  ViewStateComponent,
  ViewStateExplicitBinding,
  ViewStateTable,
} from '../main/ets/contract/generated/ViewStateTable';
import {
  ReaderUIScreenGraphDialogAdapter,
  ReaderUIScreenGraphDialogProjection,
} from '../main/ets/ui/router/ReaderUIScreenGraphDialogAdapter';
import { ReaderUIScreenGraphButtonAdapter } from '../main/ets/ui/router/ReaderUIScreenGraphButtonAdapter';

const ROUTES: RouteId[] = [
  'reader-font-import-confirm',
  'reader-font-delete-confirm',
  'reader-theme-delete-confirm',
  'reader-typography-reset-confirm',
  'reader-replace-delete-confirm',
  'source-switch-rollback',
  'reader-progress-restore',
  'import-duplicate',
  'import-conflict-resolve',
];
const DIALOG_IDS: string[] = [
  'reader_font_import_confirm-state',
  'reader_font_delete_confirm-state',
  'reader_theme_delete_confirm-state',
  'reader_typography_reset_confirm-state',
  'reader_replace_delete_confirm-state',
  'source_switch_rollback-state',
  'reader-progress-restore-dialog',
  'import_duplicate-state',
  'import_conflict_resolve-state',
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

function canonicalDialog(index: number): ViewStateComponent {
  const component: ViewStateComponent | null = componentById(
    ViewStateTable.componentsFor(ROUTES[index], 'default'),
    DIALOG_IDS[index],
  );
  return component ?? { type: '', id: '', props: {}, children: [], bindings: [] };
}

function copyDialog(component: ViewStateComponent): ViewStateComponent {
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
    children: component.children,
    bindings: [],
  };
}

function copyButton(component: ViewStateComponent): ViewStateComponent {
  return {
    type: component.type,
    id: component.id,
    props: {
      action: component.props.action,
      label: component.props.label,
      uiEvent: component.props.uiEvent,
      uiEventPayload: component.props.uiEventPayload,
      uiEventTrigger: component.props.uiEventTrigger,
    },
    children: [],
    bindings: [],
  };
}

export default function ScreenGraphDialogAdapterTests(): void {
  describe('ScreenGraphDialogAdapter', () => {
    it('projectsAllNineCanonicalDialogsWithoutInventingCopy', 0, () => {
      let messages: number = 0;
      let childButtons: number = 0;
      let executableChildren: number = 0;
      let actionGaps: number = 0;
      for (let index: number = 0; index < ROUTES.length; index += 1) {
        const component: ViewStateComponent = canonicalDialog(index);
        const projection: ReaderUIScreenGraphDialogProjection | null =
          ReaderUIScreenGraphDialogAdapter.project(component);
        expect(projection !== null).assertTrue();
        expect(projection!.title).assertEqual(component.props.title!);
        expect(projection!.message).assertEqual(component.props.message ?? '');
        expect(projection!.children.length).assertEqual(component.children.length);
        if (projection!.message.length > 0) messages += 1;
        childButtons += projection!.children.length;
        for (let childIndex: number = 0; childIndex < projection!.children.length; childIndex += 1) {
          const child: ViewStateComponent = projection!.children[childIndex];
          expect(child.type).assertEqual('Button');
          expect(child.props.enabled === undefined).assertTrue();
          expect(child.props.selected === undefined).assertTrue();
          if (child.props.uiEvent !== undefined) executableChildren += 1;
          if (child.props.action !== undefined) actionGaps += 1;
        }
      }
      expect(messages).assertEqual(8);
      expect(childButtons).assertEqual(6);
      expect(executableChildren).assertEqual(5);
      expect(actionGaps).assertEqual(1);
    });

    it('rejectsTitlePropEvidenceChildAndBindingDrift', 0, () => {
      const canonical: ViewStateComponent = canonicalDialog(0);

      const missingTitle: ViewStateComponent = copyDialog(canonical);
      missingTitle.props.title = '';
      expect(ReaderUIScreenGraphDialogAdapter.project(missingTitle) === null).assertTrue();

      const unsupportedProp: ViewStateComponent = copyDialog(canonical);
      unsupportedProp.props.enabled = true;
      expect(ReaderUIScreenGraphDialogAdapter.project(unsupportedProp) === null).assertTrue();

      const actionEvidence: ViewStateComponent = copyDialog(canonical);
      actionEvidence.props.uiEvent = 'reader.font.import';
      actionEvidence.props.uiEventPayload = JSON.parse('{}') as Object;
      actionEvidence.props.uiEventTrigger = 'tap';
      expect(ReaderUIScreenGraphDialogAdapter.project(actionEvidence) === null).assertTrue();

      const withBinding: ViewStateComponent = copyDialog(canonical);
      const binding: ViewStateExplicitBinding = {
        target: 'self', event: 'reader.font.import', payload: {}, trigger: 'tap',
      };
      withBinding.bindings = [binding];
      expect(ReaderUIScreenGraphDialogAdapter.project(withBinding) === null).assertTrue();

      const invalidChild: ViewStateComponent = copyDialog(canonical);
      const child: ViewStateComponent = copyButton(canonical.children[0]);
      child.props.enabled = true;
      invalidChild.children = [child];
      expect(ReaderUIScreenGraphDialogAdapter.project(invalidChild) === null).assertTrue();
    });

    it('keepsAllSixNestedButtonsOnTheExistingFailClosedButtonBoundary', 0, () => {
      let childButtons: number = 0;
      let admitted: number = 0;
      for (let index: number = 0; index < ROUTES.length; index += 1) {
        const dialog: ViewStateComponent = canonicalDialog(index);
        for (let childIndex: number = 0; childIndex < dialog.children.length; childIndex += 1) {
          childButtons += 1;
          if (ReaderUIScreenGraphButtonAdapter.event(
            ROUTES[index], 'default', dialog.children[childIndex],
          ) !== null) admitted += 1;
        }
      }
      expect(childButtons).assertEqual(6);
      expect(admitted).assertEqual(0);
    });
  });
}
