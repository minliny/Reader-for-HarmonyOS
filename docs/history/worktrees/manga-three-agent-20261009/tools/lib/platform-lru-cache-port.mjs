/** Node port for the documented @ohos.util.LRUCache API. This is a test seam,
 * not Reader's production eviction algorithm; production uses the SDK class. */
export class PlatformLRU {
  constructor(capacity) { this.capacity = capacity; this.data = new Map(); }
  get length() { return this.data.size; }
  get(key) { const value = this.data.get(key); if (value !== undefined) { this.data.delete(key); this.data.set(key, value); } return value; }
  put(key, value) {
    const previous = this.data.get(key); this.data.delete(key); this.data.set(key, value);
    if (previous !== undefined) this.afterRemoval(false, key, previous, value);
    while (this.data.size > this.capacity) {
      const oldest = this.data.keys().next().value, removed = this.data.get(oldest);
      this.data.delete(oldest); this.afterRemoval(true, oldest, removed, undefined);
    }
    return previous ?? value;
  }
  remove(key) { const value = this.data.get(key); if (value !== undefined) { this.data.delete(key); this.afterRemoval(false, key, value, undefined); } return value; }
  clear() { for (const key of this.keys()) this.remove(key); }
  entries() { return this.data.entries(); }
  keys() { return [...this.data.keys()]; }
  values() { return [...this.data.values()]; }
  afterRemoval() {}
}

