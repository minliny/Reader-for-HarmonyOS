// Strict, Store-free projection for canonical Content state surfaces.
// Content is a contract-owned leaf: uiEvent state-evidence explains why the
// state is visible and never becomes a click callback or reducer event.
import {
  ViewStateComponent,
  ViewStateJSONValue,
} from '../../contract/generated/ViewStateTable';

export class ReaderUIScreenGraphContentProjection {
  readonly title: string;
  readonly message: string;

  constructor(title: string, message: string) {
    this.title = title;
    this.message = message;
  }
}

export class ReaderUIScreenGraphContentAdapter {
  static project(component: ViewStateComponent): ReaderUIScreenGraphContentProjection | null {
    if (component.type !== 'Content' || component.children.length !== 0 ||
      component.bindings.length !== 0 ||
      !ReaderUIScreenGraphContentAdapter.hasOnlyContentProps(component)) {
      return null;
    }
    const title: string = ReaderUIScreenGraphContentAdapter.text(component.props.title);
    const message: string = ReaderUIScreenGraphContentAdapter.text(component.props.message);
    if (title.length === 0 || message.length === 0 ||
      !ReaderUIScreenGraphContentAdapter.validStateEvidence(component)) {
      return null;
    }
    return new ReaderUIScreenGraphContentProjection(title, message);
  }

  private static hasOnlyContentProps(component: ViewStateComponent): boolean {
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
      ReaderUIScreenGraphContentAdapter.text(component.props.uiEvent).length > 0 &&
      ReaderUIScreenGraphContentAdapter.objectPayload(component.props.uiEventPayload);
  }

  private static objectPayload(value: ViewStateJSONValue | undefined): boolean {
    return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value);
  }

  private static text(value: ViewStateJSONValue | undefined): string {
    return typeof value === 'string' ? value : '';
  }
}
