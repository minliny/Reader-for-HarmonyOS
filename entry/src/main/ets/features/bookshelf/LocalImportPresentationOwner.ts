import type { LocalImportBatch } from './LocalBookImportGateway';

export type LocalImportDialogState = 'fileSelection' | 'pickerOpening' | 'importing' | 'result';
export const LOCAL_IMPORT_PRESENTATION_KEY = 'reader.bookshelf.import.presentation.v1';
const MAX_IMPORT_RESULT_ITEMS = 50;
let nextPresentationIdentity: number = 0;

export class LocalImportPresentation {
  state: LocalImportDialogState;
  batch: LocalImportBatch | undefined;
  constructor(state: LocalImportDialogState, batch?: LocalImportBatch) { this.state = state; this.batch = batch; }
}

/** Finite process-local presentation owner; Core remains the import owner.
 * The adapter publishes one atomic string, never a state/batch pair. */
export class LocalImportPresentationOwner {
  private value: LocalImportPresentation | undefined;
  private identity: number = 0;
  private restored: boolean = false;

  current(): LocalImportPresentation | undefined { return this.value; }
  generation(): number { return this.identity; }
  serialized(): string { return this.value === undefined ? '' : JSON.stringify(this.value); }

  restore(serialized: string): void {
    if (this.restored) return;
    this.restored = true;
    const parsed = this.parse(serialized);
    // A new Runtime cannot resume another owner's picker/import task from a
    // UI string. A completed batch is a real result; in-flight presentation
    // becomes a fresh selection, without claiming the old write succeeded.
    this.value = parsed !== undefined && parsed.state !== 'result' ? new LocalImportPresentation('fileSelection') : parsed;
    this.identity = ++nextPresentationIdentity;
  }

  open(): void { this.restored = true; this.identity = ++nextPresentationIdentity; this.value = new LocalImportPresentation('fileSelection'); }
  close(): void { this.restored = true; this.identity = ++nextPresentationIdentity; this.value = undefined; }
  owns(identity: number): boolean { return identity === this.identity && this.value !== undefined; }
  write(identity: number, state: LocalImportDialogState, batch?: LocalImportBatch): boolean {
    if (!this.owns(identity) || (state === 'result' && !this.validBatch(batch))) return false;
    this.value = new LocalImportPresentation(state, state === 'result' ? batch : undefined);
    return true;
  }

  private parse(serialized: string): LocalImportPresentation | undefined {
    if (serialized.length === 0) return undefined;
    try {
      const value = JSON.parse(serialized) as LocalImportPresentation;
      if (value === null) return undefined;
      if (value.state === 'fileSelection' || value.state === 'pickerOpening' || value.state === 'importing')
        return value.batch === undefined ? new LocalImportPresentation(value.state) : undefined;
      return value.state === 'result' && this.validBatch(value.batch) ? new LocalImportPresentation('result', value.batch) : undefined;
    } catch (_) { return undefined; }
  }

  private validBatch(batch: LocalImportBatch | undefined): boolean {
    if (batch === undefined || batch === null || batch.state !== 'completed' || !Number.isSafeInteger(batch.imported) || batch.imported < 0 ||
      !Number.isSafeInteger(batch.failed) || batch.failed < 0 || !Array.isArray(batch.items) ||
      batch.items.length !== batch.imported + batch.failed || batch.items.length > MAX_IMPORT_RESULT_ITEMS) return false;
    let completed = 0;
    for (const item of batch.items) {
      if (item === null || typeof item.fileName !== 'string' || item.fileName.trim().length === 0 ||
        (item.state !== 'success' && item.state !== 'failed')) return false;
      if (item.state === 'success') completed += 1;
    }
    return completed === batch.imported;
  }
}
