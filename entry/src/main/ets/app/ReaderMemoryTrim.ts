const listeners = new Set<() => void>();

export function observeReaderMemoryTrim(listener: () => void): () => void {
  listeners.add(listener);
  return (): void => { listeners.delete(listener); };
}

export function notifyReaderMemoryTrim(): void {
  for (const listener of Array.from(listeners)) listener();
}

export class MangaNeighborMemoryAdmission {
  private revision: number = 0;
  private accepting: boolean = true;

  update(level: 'moderate' | 'low' | 'critical'): void {
    this.accepting = level === 'moderate';
    if (!this.accepting) this.revision++;
  }

  allows(): boolean { return this.accepting; }

  capture(allowed: () => boolean): () => boolean {
    const admitted = this.accepting && allowed();
    const revision = this.revision;
    return (): boolean => admitted && revision === this.revision && this.accepting && allowed();
  }
}
