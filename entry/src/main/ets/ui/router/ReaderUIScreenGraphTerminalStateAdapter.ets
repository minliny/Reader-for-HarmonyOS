// Strict, Store-free projections for the two canonical terminal leaf states.
// Retryability and permission evidence are state semantics only. Neither type
// owns a binding, so this adapter never creates an action or reducer event.
import {
  ViewStateComponent,
  ViewStateJSONValue,
} from '../../contract/generated/ViewStateTable';

interface ReaderUIScreenGraphPermissionEvidencePayload {
  permission?: string;
  reason?: string;
}

export class ReaderUIScreenGraphErrorProjection {
  readonly message: string;
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    this.message = message;
    this.retryable = retryable;
  }
}

export class ReaderUIScreenGraphPermissionProjection {
  readonly title: string;
  readonly message: string;

  constructor(title: string, message: string) {
    this.title = title;
    this.message = message;
  }
}

export class ReaderUIScreenGraphTerminalStateAdapter {
  static projectError(component: ViewStateComponent): ReaderUIScreenGraphErrorProjection | null {
    if (component.type !== 'Error' || component.children.length !== 0 ||
      component.bindings.length !== 0 ||
      !ReaderUIScreenGraphTerminalStateAdapter.hasOnlyProps(component, ['message', 'retryable'])) {
      return null;
    }
    const message: string = ReaderUIScreenGraphTerminalStateAdapter.text(component.props.message);
    if (message.length === 0 || typeof component.props.retryable !== 'boolean') return null;
    return new ReaderUIScreenGraphErrorProjection(message, component.props.retryable);
  }

  static projectPermission(component: ViewStateComponent): ReaderUIScreenGraphPermissionProjection | null {
    if (component.type !== 'Permission' || component.children.length !== 0 ||
      component.bindings.length !== 0 ||
      !ReaderUIScreenGraphTerminalStateAdapter.hasOnlyProps(component, [
        'message', 'title', 'uiEvent', 'uiEventPayload', 'uiEventTrigger',
      ])) {
      return null;
    }
    const title: string = ReaderUIScreenGraphTerminalStateAdapter.text(component.props.title);
    const message: string = ReaderUIScreenGraphTerminalStateAdapter.text(component.props.message);
    if (title.length === 0 || message.length === 0 ||
      component.props.uiEvent !== 'import.permission.denied' ||
      component.props.uiEventTrigger !== 'state-evidence' ||
      !ReaderUIScreenGraphTerminalStateAdapter.validPermissionPayload(component.props.uiEventPayload)) {
      return null;
    }
    return new ReaderUIScreenGraphPermissionProjection(title, message);
  }

  private static hasOnlyProps(component: ViewStateComponent, allowedProps: string[]): boolean {
    const allowed: Set<string> = new Set<string>(allowedProps);
    const keys: string[] = Object.keys(component.props);
    for (let index: number = 0; index < keys.length; index += 1) {
      if (!allowed.has(keys[index])) return false;
    }
    return true;
  }

  private static validPermissionPayload(value: ViewStateJSONValue | undefined): boolean {
    if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) return false;
    const payload: ReaderUIScreenGraphPermissionEvidencePayload =
      value as ReaderUIScreenGraphPermissionEvidencePayload;
    const keys: string[] = Object.keys(payload);
    return keys.length === 2 && payload.permission === 'storage' && payload.reason === 'denied';
  }

  private static text(value: ViewStateJSONValue | undefined): string {
    return typeof value === 'string' ? value : '';
  }
}
