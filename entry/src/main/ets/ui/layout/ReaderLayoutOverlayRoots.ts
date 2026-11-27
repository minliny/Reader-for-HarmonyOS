/** Registry of mounted, app-owned roots that may be outside the page subtree. */
export class ReaderLayoutOverlayRoots {
  private readonly windows: Map<number | undefined, Map<string, number>> = new Map();
  private generation: number = 0;

  mount(windowId: number | undefined, id: string): () => boolean {
    let roots = this.windows.get(windowId);
    if (roots === undefined) {
      roots = new Map<string, number>();
      this.windows.set(windowId, roots);
    }
    const currentRoots = roots;
    const generation = ++this.generation;
    currentRoots.set(id, generation);
    return (): boolean => {
      if (currentRoots.get(id) !== generation) return false;
      currentRoots.delete(id);
      if (currentRoots.size === 0) this.windows.delete(windowId);
      return true;
    };
  }

  active(windowId: number | undefined): string[] {
    const roots = this.windows.get(windowId);
    return roots === undefined ? [] : Array.from(roots.keys());
  }
}
