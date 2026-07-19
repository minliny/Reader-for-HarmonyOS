// Exact, Store-free projection for the canonical ScreenGraph Dialog batch.
//
// Dialog owns only its visible title/message and ordered Button children.
// State-evidence remains descriptive. Child actions still cross the existing
// Button adapter, so a contract binding without a proven Host/reducer mapping
// is rendered but remains inert.
import {
  ViewStateComponent,
  ViewStateJSONValue,
} from '../../contract/generated/ViewStateTable';

export class ReaderUIScreenGraphDialogProjection {
  readonly title: string;
  readonly message: string;
  readonly children: ViewStateComponent[];

  constructor(title: string, message: string, children: ViewStateComponent[]) {
    this.title = title;
    this.message = message;
    this.children = children;
  }
}

export class ReaderUIScreenGraphDialogAdapter {
  static project(component: ViewStateComponent): ReaderUIScreenGraphDialogProjection | null {
    if (component.type !== 'Dialog' || component.bindings.length !== 0 ||
      !ReaderUIScreenGraphDialogAdapter.hasOnlyDialogProps(component)) {
      return null;
    }
    const title: string = ReaderUIScreenGraphDialogAdapter.text(component.props.title);
    if (title.length === 0 || !ReaderUIScreenGraphDialogAdapter.validStateEvidence(component)) {
      return null;
    }
    for (let index: number = 0; index < component.children.length; index += 1) {
      if (!ReaderUIScreenGraphDialogAdapter.validButtonChild(component.children[index])) return null;
    }
    return new ReaderUIScreenGraphDialogProjection(
      title,
      ReaderUIScreenGraphDialogAdapter.text(component.props.message),
      component.children,
    );
  }

  private static hasOnlyDialogProps(component: ViewStateComponent): boolean {
    const allowed: Set<string> = new Set<string>([
      'message', 'title', 'uiEvent', 'uiEventPayload', 'uiEventTrigger',
    ]);
    const keys: string[] = Object.keys(component.props);
    for (let index: number = 0; index < keys.length; index += 1) {
      if (!allowed.has(keys[index])) return false;
    }
    return true;
  }

  private static validStateEvidence(component: ViewStateComponent): boolean {
    const trigger: string | undefined = component.props.uiEventTrigger;
    if (trigger === undefined) {
      return component.props.uiEvent === undefined && component.props.uiEventPayload === undefined;
    }
    return trigger === 'state-evidence' &&
      ReaderUIScreenGraphDialogAdapter.text(component.props.uiEvent).length > 0 &&
      ReaderUIScreenGraphDialogAdapter.objectPayload(component.props.uiEventPayload);
  }

  private static validButtonChild(child: ViewStateComponent): boolean {
    if (child.type !== 'Button' || child.children.length !== 0 || child.bindings.length !== 0 ||
      ReaderUIScreenGraphDialogAdapter.text(child.props.label).length === 0 ||
      child.props.enabled !== undefined || child.props.selected !== undefined ||
      child.props.destructive !== undefined) {
      return false;
    }
    if (child.props.uiEvent === undefined) {
      return ReaderUIScreenGraphDialogAdapter.text(child.props.action).length > 0 &&
        child.props.uiEventTrigger === undefined && child.props.uiEventPayload === undefined;
    }
    return child.props.action === undefined && child.props.uiEventTrigger === 'tap' &&
      ReaderUIScreenGraphDialogAdapter.objectPayload(child.props.uiEventPayload);
  }

  private static objectPayload(value: ViewStateJSONValue | undefined): boolean {
    return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value);
  }

  private static text(value: ViewStateJSONValue | undefined): string {
    return typeof value === 'string' ? value : '';
  }
}
