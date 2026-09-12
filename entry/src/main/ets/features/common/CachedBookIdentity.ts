import type { JsonObject } from '@reader/core-harmony';

/** One source-scoped record can connect its current and historical aliases. */
export class CachedBookIdentityIndex {
  private parents = new Map<string, string>();
  private weights = new Map<string, number>();
  private aliases = new Map<string, string>();

  private key(sourceId: string, bookUrl: string): string {
    return JSON.stringify([sourceId, bookUrl]);
  }

  private root(key: string): string {
    let root = key;
    while (this.parents.get(root) !== root) root = this.parents.get(root) as string;
    while (key !== root) {
      const parent = this.parents.get(key) as string;
      this.parents.set(key, root);
      key = parent;
    }
    return root;
  }

  admit(sourceId: string, bookUrl: string, alias: string): void {
    const key = this.key(sourceId, bookUrl);
    if (!this.parents.has(key)) {
      this.parents.set(key, key);
      this.weights.set(key, 1);
    }
    const previous = this.aliases.get(alias);
    if (previous === undefined) {
      this.aliases.set(alias, key);
      return;
    }
    let left = this.root(previous);
    let right = this.root(key);
    if (left === right) return;
    if ((this.weights.get(left) as number) < (this.weights.get(right) as number)) {
      const swap = left; left = right; right = swap;
    }
    this.parents.set(right, left);
    this.weights.set(left, (this.weights.get(left) as number) + (this.weights.get(right) as number));
    this.weights.delete(right);
  }

  groupFor(sourceId: string, bookUrl: string): string | undefined {
    const key = this.key(sourceId, bookUrl);
    return this.parents.has(key) ? this.root(key) : undefined;
  }

  groupForAlias(alias: string): string | undefined {
    const key = this.aliases.get(alias);
    return key === undefined ? undefined : this.root(key);
  }
}

/** Shared cache projection, not a second source search or persisted fact store. */
export class CachedBookIdentityResolver {
  private normalizedText = new Map<string, string>();

  private normalize(text: string): string {
    const cached = this.normalizedText.get(text);
    if (cached !== undefined) return cached;
    const normalized = text.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    if (text.length <= 2048) {
      if (this.normalizedText.size >= 2048) {
        for (const oldest of this.normalizedText.keys()) { this.normalizedText.delete(oldest); break; }
      }
      this.normalizedText.set(text, normalized);
    }
    return normalized;
  }

  aliasKey(name: string, author: string): string {
    // Match the complete pair. Missing authors are not a wildcard.
    return JSON.stringify([this.normalize(name), this.normalize(author)]);
  }

  async build(rows: JsonObject[], enabledSourceIds: Set<string>): Promise<CachedBookIdentityIndex> {
    const index = new CachedBookIdentityIndex();
    let processed = 0;
    for (const row of rows) {
      if (++processed % 32 === 0) await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
      const sourceId = row['origin'];
      const bookUrl = row['bookUrl'];
      if (typeof sourceId !== 'string' || typeof bookUrl !== 'string' || !enabledSourceIds.has(sourceId)) continue;
      const name = row['name'];
      const author = typeof row['author'] === 'string' ? row['author'] as string : '';
      if (typeof name === 'string' && name.trim().length > 0) index.admit(sourceId, bookUrl, this.aliasKey(name, author));
      const facts = row['acquisition'] as JsonObject | undefined;
      if (!Array.isArray(facts?.['aliases'])) continue;
      for (const raw of facts['aliases']) {
        if (++processed % 32 === 0) await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const alias = raw as JsonObject;
        const aliasName = alias['name'];
        if (typeof aliasName !== 'string' || aliasName.trim().length === 0) continue;
        const aliasAuthor = typeof alias['author'] === 'string' ? alias['author'] as string : '';
        index.admit(sourceId, bookUrl, this.aliasKey(aliasName, aliasAuthor));
      }
    }
    return index;
  }
}
