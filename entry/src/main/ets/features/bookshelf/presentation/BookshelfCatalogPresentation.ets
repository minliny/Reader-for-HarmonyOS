import hilog from '@ohos.hilog';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import type { RemoteReadingSession } from '../../reading/application/RemoteReadingFlowGateway';
import { BookshelfCatalogOwner, type BookshelfCatalogBinding, type BookshelfCatalogSnapshot } from '../application/BookshelfCatalogOwner';
import type { BookshelfDataState, BookshelfFilter } from '../application/BookshelfFlowGateway';
import { sameBookshelfProjectionScene, type BookshelfProjectionScene } from './BookshelfReadPresentation';

const DOMAIN = 0x5244;
const CATALOG_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export interface BookshelfCatalogPorts {
  scene: () => BookshelfProjectionScene | undefined;
  catalog: (owner: ReaderRuntimeOwner) => BookshelfCatalogOwner | undefined;
  automaticAllowed: () => boolean;
  revision: () => string;
  filter: () => BookshelfFilter;
  project: (state: BookshelfDataState) => void;
  prefetch: (session: RemoteReadingSession, current: () => boolean, owner: ReaderRuntimeOwner) => Promise<void>;
  feedback: (message: string, current: () => boolean) => void;
}

@Observed
export class BookshelfCatalogPresentation {
  snapshot: BookshelfCatalogSnapshot = { generation: 0, manualRunning: false,
    automaticRunning: false, done: 0, total: 0, readbackFailed: false };
  private owner: BookshelfCatalogOwner | undefined;
  private binding: BookshelfCatalogBinding | undefined;
  private feedbackKey: string = '';

  private readonly ports: BookshelfCatalogPorts;
  constructor(ports: BookshelfCatalogPorts) { this.ports = ports; }

  private attach(): void {
    const ports = this.ports, scene = ports.scene();
    if (scene === undefined || scene.route !== 'bookshelf') return;
    const owner = ports.catalog(scene.owner);
    if (owner === undefined) return;
    const identity = JSON.stringify([scene.instance, scene.mounting, scene.navigation, 'shelf-catalog']);
    if (this.owner === owner && this.binding?.identity === identity) return;
    this.retire();
    const current = (): boolean => sameBookshelfProjectionScene(scene, ports.scene());
    const binding: BookshelfCatalogBinding = { identity, current,
      automaticAllowed: ports.automaticAllowed, revision: ports.revision, filter: ports.filter,
      project: ports.project,
      prefetch: (session: RemoteReadingSession, live: () => boolean): Promise<void> => ports.prefetch(session, live, scene.owner),
      diagnostic: (message: string): void => hilog.warn(DOMAIN, 'Reader', '%{private}s', message),
      emit: (snapshot: BookshelfCatalogSnapshot): void => this.publish(snapshot, current),
    };
    this.owner = owner;
    this.binding = binding;
    owner.attach(binding);
  }

  retire(): void {
    this.owner?.detach(this.binding?.identity ?? '');
    this.owner = undefined;
    this.binding = undefined;
    const snapshot = this.snapshot;
    if (snapshot.manualRunning || snapshot.automaticRunning) {
      this.snapshot = { generation: snapshot.generation, manualRunning: false, automaticRunning: false,
        done: snapshot.done, total: snapshot.total, readbackFailed: snapshot.readbackFailed,
        facts: snapshot.facts, seeds: snapshot.seeds };
    }
  }

  automatic(books: ShelfBook[]): void {
    this.attach();
    if (this.binding?.current() === true) this.owner?.automatic(books, this.binding, CATALOG_REFRESH_INTERVAL_MS);
  }

  manual(books: ShelfBook[]): void {
    this.attach();
    if (this.binding?.current() === true) this.owner?.manual(books, this.binding, CATALOG_REFRESH_INTERVAL_MS);
  }

  async reconcile(generation: number): Promise<void> {
    this.attach();
    if (this.binding?.current() === true) await this.owner?.reconcile(generation, this.binding);
  }

  private publish(snapshot: BookshelfCatalogSnapshot, current: () => boolean): void {
    this.snapshot = snapshot;
    const facts = snapshot.facts;
    if (snapshot.manualRunning || snapshot.automaticRunning || facts === undefined || facts.fact === 'current') {
      this.feedbackKey = '';
      return;
    }
    if (!current() || (facts.fact !== 'refreshFailed' && facts.fact !== 'failed' && facts.fact !== 'partial')) return;
    const message = facts.message ?? '刷新失败，保留已有书架';
    const key = `${facts.generation}:${message}`;
    if (key === this.feedbackKey) return;
    this.feedbackKey = key;
    try { this.ports.feedback(message, current); } catch (_) {}
  }
}
