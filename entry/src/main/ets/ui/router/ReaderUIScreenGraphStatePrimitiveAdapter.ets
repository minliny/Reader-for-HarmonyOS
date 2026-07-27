// Exact, Store-free projection for contract-owned state primitives.
// State-evidence describes why a surface is visible; it is never an action.
import {
  ViewStateComponent,
  ViewStateJSONValue,
} from '../../contract/generated/ViewStateTable';

export class ReaderUIScreenGraphStatePrimitiveProjection {
  readonly title: string;
  readonly message: string;
  readonly retryEnabled: boolean;

  constructor(title: string, message: string) {
    this.title = title;
    this.message = message;
    this.retryEnabled = false;
  }
}

export class ReaderUIScreenGraphStatePrimitiveAdapter {
  static project(component: ViewStateComponent): ReaderUIScreenGraphStatePrimitiveProjection | null {
    if (component.type !== 'Loading' && component.type !== 'ErrorState' && component.type !== 'Offline') {
      return null;
    }
    // These faithful primitives are leaf, state-only surfaces. Any action or
    // child appearing here requires a new ownership audit and must fail closed.
    if (component.children.length !== 0 || component.bindings.length !== 0) return null;
    const trigger: ViewStateJSONValue | undefined = component.props.uiEventTrigger;
    if (trigger !== undefined && trigger !== 'state-evidence') return null;
    const title: string = ReaderUIScreenGraphStatePrimitiveAdapter.text(component.props.title);
    const label: string = ReaderUIScreenGraphStatePrimitiveAdapter.text(component.props.label);
    return new ReaderUIScreenGraphStatePrimitiveProjection(
      title.length > 0 ? title : label,
      ReaderUIScreenGraphStatePrimitiveAdapter.text(component.props.message),
    );
  }

  private static text(value: ViewStateJSONValue | undefined): string {
    return typeof value === 'string' ? value : '';
  }
}
