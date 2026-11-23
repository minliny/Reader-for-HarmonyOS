import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderRectVp } from '../foundation/ReaderWindowMetrics';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { ReaderEditingVisibility } from './ReaderEditingVisibility';

let nextEditingScroll: number = 0;
/** Adapts an existing native Scroll/List; it does not add another scroll tree. */
export class ReaderEditingScrollBinding {
  readonly id: string;
  constructor(id: string = '') { this.id = id.length > 0 ? id : `reader-editing-scroll:${++nextEditingScroll}`; }
  private revision: number = 0;
  private host: ReaderEditingVisibility | undefined = undefined;
  private mountedId: string = '';
  idFor(scope: string): string { return scope.length > 0 ? `${this.id}:${scope}` : this.id; }
  mount(context: UIContext, host: ReaderEditingVisibility | undefined, scroller: Scroller,
    topInset: () => number = (): number => 0, scope: string = ''): void {
    const revision = ++this.revision;
    const id = this.idFor(scope);
    this.mountedId = id;
    this.host = host;
    host?.mount({ current: (): boolean => revision === this.revision && this.host === host &&
        AppStorage.get<boolean>('readerAppForeground') !== false,
      metrics: readerWindowMetrics,
      viewport: (): ReaderRectVp | undefined => {
        try {
          const node = context.getFrameNodeById(id);
          if (node === null) return undefined;
          const position = node.getPositionToWindowWithTransform();
          const info = context.getComponentUtils().getRectangleById(id);
          const top = Math.max(0, topInset());
          return new ReaderRectVp(position.x, position.y + top, context.px2vp(info.size.width),
            Math.max(0, context.px2vp(info.size.height) - top));
        } catch (_detached) { return undefined; }
      },
      scroll: (delta: number): void => { try { scroller.scrollBy(0, delta); } catch (_detached) {} },
    });
  }
  unmount(scope?: string): void {
    if (scope !== undefined && this.idFor(scope) !== this.mountedId) return;
    this.revision += 1; this.host?.unmount(); this.host = undefined; this.mountedId = '';
  }
}
