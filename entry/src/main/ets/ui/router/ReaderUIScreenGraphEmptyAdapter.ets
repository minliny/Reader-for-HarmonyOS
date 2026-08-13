// Strict, Store-free projection for canonical Empty state surfaces.
// uiEvent state-evidence explains why the empty state is visible and never
// becomes a click callback or reducer event.
import {
  ViewStateComponent,
  ViewStateJSONValue,
} from '../../contract/generated/ViewStateTable';

export class ReaderUIScreenGraphEmptyProjection {
  readonly title: string;
  readonly message: string;

  constructor(title: string, message: string) {
    this.title = title;
    this.message = message;
  }
}

export class ReaderUIScreenGraphEmptyAdapter {
  static project(component: ViewStateComponent): ReaderUIScreenGraphEmptyProjection | null {
    if (component.type !== 'Empty' || component.children.length !== 0 ||
      component.bindings.length !== 0 ||
      !ReaderUIScreenGraphEmptyAdapter.hasOnlyEmptyProps(component)) {
      return null;
    }
    const title: string = ReaderUIScreenGraphEmptyAdapter.text(component.props.title);
    const message: string = ReaderUIScreenGraphEmptyAdapter.text(component.props.message);
    if (title.length === 0 || message.length === 0 ||
      !ReaderUIScreenGraphEmptyAdapter.validStateEvidence(component)) {
      return null;
    }
    return new ReaderUIScreenGraphEmptyProjection(title, message);
  }

  private static hasOnlyEmptyProps(component: ViewStateComponent): boolean {
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
    return component.props.uiEventTrigger === 'state-evidence' &&
      ReaderUIScreenGraphEmptyAdapter.text(component.props.uiEvent).length > 0 &&
      ReaderUIScreenGraphEmptyAdapter.objectPayload(component.props.uiEventPayload);
  }

  private static objectPayload(value: ViewStateJSONValue | undefined): boolean {
    return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value);
  }

  private static text(value: ViewStateJSONValue | undefined): string {
    return typeof value === 'string' ? value : '';
  }
}
