import { describe, it, expect } from '@ohos/hypium';
import {
  ViewStateComponent,
  ViewStateExplicitBinding,
  ViewStateTable,
} from '../main/ets/contract/generated/ViewStateTable';
import {
  ReaderUIScreenGraphErrorProjection,
  ReaderUIScreenGraphPermissionProjection,
  ReaderUIScreenGraphTerminalStateAdapter,
} from '../main/ets/ui/router/ReaderUIScreenGraphTerminalStateAdapter';

function componentById(components: ViewStateComponent[], id: string): ViewStateComponent | null {
  for (let index: number = 0; index < components.length; index += 1) {
    const component: ViewStateComponent = components[index];
    if (component.id === id) return component;
    const nested: ViewStateComponent | null = componentById(component.children, id);
    if (nested !== null) return nested;
  }
  return null;
}

function canonical(routeId: 'state-error' | 'import-permission-denied', pageState: string,
  id: string): ViewStateComponent {
  const component: ViewStateComponent | null = componentById(
    ViewStateTable.componentsFor(routeId, pageState), id,
  );
  return component ?? { type: '', id: '', props: {}, children: [], bindings: [] };
}

function copy(component: ViewStateComponent): ViewStateComponent {
  return {
    type: component.type,
    id: component.id,
    props: {
      message: component.props.message,
      retryable: component.props.retryable,
      title: component.props.title,
      uiEvent: component.props.uiEvent,
      uiEventPayload: component.props.uiEventPayload,
      uiEventTrigger: component.props.uiEventTrigger,
    },
    children: [],
    bindings: [],
  };
}

export default function ScreenGraphTerminalStateAdapterTests(): void {
  describe('ScreenGraphTerminalStateAdapter', () => {
    it('projectsCanonicalErrorRetryabilityAsStateWithoutCreatingRetryAction', 0, () => {
      const component: ViewStateComponent = canonical('state-error', 'error', 'global-error');
      const projection: ReaderUIScreenGraphErrorProjection | null =
        ReaderUIScreenGraphTerminalStateAdapter.projectError(component);
      expect(projection !== null).assertTrue();
      expect(projection!.message).assertEqual('网络异常');
      expect(projection!.retryable).assertTrue();
      expect(component.bindings.length).assertEqual(0);
      expect(component.children.length).assertEqual(0);
    });

    it('projectsCanonicalPermissionEvidenceAsDisplayOnlyState', 0, () => {
      const component: ViewStateComponent = canonical(
        'import-permission-denied', 'permission', 'import_permission_denied-state',
      );
      const projection: ReaderUIScreenGraphPermissionProjection | null =
        ReaderUIScreenGraphTerminalStateAdapter.projectPermission(component);
      expect(projection !== null).assertTrue();
      expect(projection!.title).assertEqual('导入权限被拒绝');
      expect(projection!.message).assertEqual('导入权限被拒绝');
      expect(component.props.uiEvent).assertEqual('import.permission.denied');
      expect(component.props.uiEventTrigger).assertEqual('state-evidence');
      expect(component.bindings.length).assertEqual(0);
      expect(component.children.length).assertEqual(0);
    });

    it('keepsErrorAndPermissionSchemasSeparateAndFailClosed', 0, () => {
      const error: ViewStateComponent = canonical('state-error', 'error', 'global-error');
      const errorAction: ViewStateComponent = copy(error);
      errorAction.props.action = '重试';
      expect(ReaderUIScreenGraphTerminalStateAdapter.projectError(errorAction) === null).assertTrue();

      const errorMissingRetryable: ViewStateComponent = copy(error);
      errorMissingRetryable.props.retryable = undefined;
      expect(ReaderUIScreenGraphTerminalStateAdapter.projectError(errorMissingRetryable) === null).assertTrue();

      const permission: ViewStateComponent = canonical(
        'import-permission-denied', 'permission', 'import_permission_denied-state',
      );
      const permissionAction: ViewStateComponent = copy(permission);
      permissionAction.props.action = '去授权';
      expect(ReaderUIScreenGraphTerminalStateAdapter.projectPermission(permissionAction) === null).assertTrue();

      const permissionTap: ViewStateComponent = copy(permission);
      permissionTap.props.uiEventTrigger = 'tap';
      expect(ReaderUIScreenGraphTerminalStateAdapter.projectPermission(permissionTap) === null).assertTrue();

      const permissionWrongPayload: ViewStateComponent = copy(permission);
      permissionWrongPayload.props.uiEventPayload = JSON.parse('{"permission":"camera","reason":"denied"}') as Object;
      expect(ReaderUIScreenGraphTerminalStateAdapter.projectPermission(permissionWrongPayload) === null).assertTrue();

      const unexpectedChild: ViewStateComponent = {
        type: 'Button', id: 'unexpected', props: {}, children: [], bindings: [],
      };
      const errorChild: ViewStateComponent = copy(error);
      errorChild.children = [unexpectedChild];
      expect(ReaderUIScreenGraphTerminalStateAdapter.projectError(errorChild) === null).assertTrue();

      const binding: ViewStateExplicitBinding = {
        target: 'self', event: 'permission.request', payload: {}, trigger: 'tap',
      };
      const permissionBinding: ViewStateComponent = copy(permission);
      permissionBinding.bindings = [binding];
      expect(ReaderUIScreenGraphTerminalStateAdapter.projectPermission(permissionBinding) === null).assertTrue();
    });
  });
}
