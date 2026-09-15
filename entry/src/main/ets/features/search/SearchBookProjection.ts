import { readBookAuthorIdentity } from '../common/BookAuthorMetadata';
import type { JsonObject } from '@reader/core-harmony';
import type { BookAcquisitionChange } from '../../app/BookAcquisitionCoordinator';
import type { RemoteReadingIdentity } from '../reading/RemoteReadingContract';
import type { SearchBook, SearchBookVariable, SearchSource } from './SearchGateway';

export interface SearchBookPatch {
  upserted: SearchBook[];
  removedKeys: string[];
  captured: Map<string, SearchBook | undefined>;
  retryIdentities: RemoteReadingIdentity[];
  diagnostics: string[];
}
interface ProjectionRow { row: JsonObject; relationKey: string; relationRevision: string; }
interface SourcePartition { rows: Map<string, ProjectionRow>; missing: Set<string>; valid: boolean; }
type ProjectionRequest = (method: string, params: JsonObject) => Promise<JsonObject>;

/** Query-scoped Core projection. SQLite owns relation closure; this adapter owns card identity. */
export class SearchBookProjection {
  private epoch: number = 0;
  private initialized: boolean = false;
  private facts: Map<string, ProjectionRow> = new Map();
  private relations: Map<string, Set<string>> = new Map();
  private groups: Map<string, Set<string>> = new Map();
  private groupByIdentity: Map<string, string> = new Map();
  private nextOrder: number = 0;

  reset(): void {
    this.epoch += 1; this.initialized = false; this.facts.clear(); this.relations.clear(); this.groups.clear();
    this.groupByIdentity.clear(); this.nextOrder = 0;
  }
  private key(sourceId: string, bookId: string): string { return `${sourceId}\u0000${bookId}`; }
  private identity(key: string): RemoteReadingIdentity {
    const boundary = key.indexOf('\u0000');
    return { sourceId: key.slice(0, boundary), bookId: key.slice(boundary + 1) };
  }
  private string(value: JsonObject, key: string): string {
    const result = value[key];
    if (typeof result !== 'string') throw new Error(`invalid search projection ${key}`);
    return result;
  }
  private object(value: unknown): JsonObject {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid search projection row');
    return value as JsonObject;
  }
  private decode(raw: unknown): ProjectionRow {
    const row = this.object(raw);
    this.string(row, 'origin'); this.string(row, 'bookUrl'); this.string(row, 'name'); this.string(row, 'author');
    for (const key of ['coverUrl', 'intro', 'kind', 'latestChapterTitle', 'variable']) {
      if (row[key] !== undefined && row[key] !== null) this.string(row, key);
    }
    if (row['acquisition'] !== undefined) this.string(this.object(row['acquisition']), 'sourceVersion');
    const relationKey = this.string(row, 'relationKey'); const relationRevision = this.string(row, 'relationRevision');
    if (relationKey.length === 0 || relationRevision.length === 0) throw new Error('blank search relation');
    return { row, relationKey, relationRevision };
  }
  private project(value: ProjectionRow, source: SearchSource, previous: SearchBook | undefined,
    seed: SearchBook): SearchBook {
    const row = value.row;
    const facts = row['acquisition'] === undefined ? undefined : this.object(row['acquisition']);
    // A stale source's stored facts cannot replace this sweep's immutable continuation.
    if (facts !== undefined && facts['sourceVersion'] !== source.sourceVersion) {
      if (previous !== undefined) return previous;
      throw new Error('cached book source version is stale');
    }
    const bookId = this.string(row, 'bookUrl');
    let variables: SearchBookVariable[] = previous?.variables ?? [];
    if (previous === undefined && typeof row['variable'] === 'string') {
      try {
        const parsed = this.object(JSON.parse(row['variable'] as string));
        variables = Object.keys(parsed).sort().map((name: string): SearchBookVariable => ({ name, value: this.string(parsed, name) }));
      } catch (_error) { variables = []; }
    }
    const result: SearchBook = { ...(previous ?? seed), sourceId: source.sourceId, sourceName: source.name,
      bookSourceUrl: source.baseUrl ?? source.sourceId, bookId, detailUrl: bookId,
      sourceRuleVersion: previous?.sourceRuleVersion ?? source.sourceVersion ?? '', category: source.category,
      title: this.string(row, 'name') || previous?.title || seed.title, author: this.string(row, 'author'),
      authorIdentity: readBookAuthorIdentity(facts?.['authorIdentity'], this.string(row, 'author'), source.sourceVersion),
      coverUrl: row['coverUrl'] as string | undefined, intro: row['intro'] as string | undefined,
      kind: row['kind'] as string | undefined, latestChapterTitle: row['latestChapterTitle'] as string | undefined,
      acquisition: facts, variables, admittedOrder: previous?.admittedOrder };
    if (previous !== undefined) {
      result.coverUrl = result.coverUrl ?? previous.coverUrl; result.intro = result.intro ?? previous.intro;
      result.kind = result.kind ?? previous.kind; result.latestChapterTitle = result.latestChapterTitle ?? previous.latestChapterTitle;
    }
    return result;
  }
  private same(left: SearchBook, right: SearchBook): boolean {
    return left.title === right.title && left.author === right.author &&
      JSON.stringify(left.authorIdentity) === JSON.stringify(right.authorIdentity) && left.coverUrl === right.coverUrl &&
      left.intro === right.intro && left.kind === right.kind && left.latestChapterTitle === right.latestChapterTitle &&
      left.groupKey === right.groupKey && left.sourceName === right.sourceName && left.category === right.category &&
      left.sourceRuleVersion === right.sourceRuleVersion && left.bookSourceUrl === right.bookSourceUrl &&
      JSON.stringify(left.acquisition) === JSON.stringify(right.acquisition);
  }

  async refresh(books: Map<string, SearchBook>, change: BookAcquisitionChange, sources: SearchSource[],
    request: ProjectionRequest, registryCurrent: () => boolean): Promise<SearchBookPatch> {
    const epoch = this.epoch;
    const current = (): void => { if (epoch !== this.epoch || !registryCurrent()) throw new Error('search projection superseded'); };
    const sourceById = new Map<string, SearchSource>();
    for (const source of sources) if (source.enabled && source.category === 'novel') sourceById.set(source.sourceId, source);
    const requested = new Map<string, RemoteReadingIdentity>();
    if (change.reset || !this.initialized) {
      for (const [key, book] of books) if (book.sourceId !== 'local') requested.set(key, { sourceId: book.sourceId, bookId: book.bookId });
    }
    for (const identity of change.identities) if (identity.sourceId !== 'local') requested.set(this.key(identity.sourceId, identity.bookId), identity);
    // Existing members of a changed relation are fetched only when relation facts change below.
    const captured = new Map<string, SearchBook | undefined>();
    const partitions = new Map<string, SourcePartition>();
    const retry = new Map<string, RemoteReadingIdentity>();
    const diagnostics: string[] = [];
    const removed = new Set<string>();
    const staged = new Map<string, ProjectionRow>();
    const readBatch = async (identities: RemoteReadingIdentity[]): Promise<void> => {
      // Partition RPCs by source. One malformed response never invalidates another source's metadata.
      const bySource = new Map<string, RemoteReadingIdentity[]>();
      for (const identity of identities) {
        const list = bySource.get(identity.sourceId) ?? []; list.push(identity); bySource.set(identity.sourceId, list);
        const key = this.key(identity.sourceId, identity.bookId); captured.set(key, books.get(key));
      }
      for (const [sourceId, ids] of bySource) {
        let partition = partitions.get(sourceId);
        if (partition === undefined) { partition = { rows: new Map(), missing: new Set(), valid: true }; partitions.set(sourceId, partition); }
        const source = sourceById.get(sourceId);
        if (source === undefined) { for (const identity of ids) partition.missing.add(this.key(sourceId, identity.bookId)); continue; }
        try {
          let snapshot: string | undefined = undefined;
          for (let start = 0; start < ids.length; start += 128) {
            current();
            const batch = ids.slice(start, start + 128);
            const result = await request('search-book.batch.get', { identities: batch }); current();
            if (result['complete'] !== true || !Array.isArray(result['books']) || !Array.isArray(result['missing']) ||
              !Array.isArray(result['sourceVersions'])) throw new Error('incomplete search identity batch');
            const observed = this.string(result, 'snapshotRevision');
            if (snapshot !== undefined && snapshot !== observed) throw new Error('search batch snapshot changed');
            snapshot = observed;
            const version = (result['sourceVersions'] as JsonObject[]).find((item: JsonObject): boolean => item['sourceId'] === sourceId);
            if (version === undefined || version['enabled'] !== true || version['sourceVersion'] !== source.sourceVersion) throw new Error('search source snapshot changed');
            const expected = new Set(batch.map((identity: RemoteReadingIdentity): string => this.key(identity.sourceId, identity.bookId)));
            const returned = new Set<string>();
            for (const raw of result['books']) {
              const row = this.decode(raw); const key = this.key(this.string(row.row, 'origin'), this.string(row.row, 'bookUrl'));
              if (!expected.has(key) || returned.has(key)) throw new Error('search batch identity mismatch');
              returned.add(key); partition.rows.set(key, row);
            }
            for (const raw of result['missing']) {
              const identity = this.object(raw); const key = this.key(this.string(identity, 'sourceId'), this.string(identity, 'bookId'));
              if (!expected.has(key) || returned.has(key)) throw new Error('search batch missing identity mismatch');
              returned.add(key); partition.missing.add(key);
            }
            if (returned.size !== expected.size) throw new Error('truncated search identity batch');
            if (start + 128 < ids.length) { await new Promise<void>((resolve): void => { setTimeout(resolve, 0); }); current(); }
          }
        } catch (error) {
          current(); partition.valid = false;
          diagnostics.push(error instanceof Error ? error.message : 'invalid source partition');
          for (const identity of ids) retry.set(this.key(sourceId, identity.bookId), identity);
        }
      }
    };
    await readBatch(Array.from(requested.values())); current();
    for (const partition of partitions.values()) if (partition.valid) {
      for (const [key, row] of partition.rows) staged.set(key, row);
      // Missing on first enrichment retains live search payload. Later explicit deletion can remove admitted cache members.
      for (const key of partition.missing) if (this.facts.has(key) || !sourceById.has(this.identity(key).sourceId)) removed.add(key);
    }
    const relationChanges = new Map<string, string>();
    const stagedRelationVersions = new Map<string, string>();
    for (const [key, row] of staged) {
      const old = this.facts.get(key);
      if (old !== undefined && (old.relationKey !== row.relationKey || old.relationRevision !== row.relationRevision)) {
        relationChanges.set(old.relationKey, key);
      }
      const knownKey = this.relations.get(row.relationKey)?.values().next().value as string | undefined;
      const knownRevision = knownKey === undefined ? stagedRelationVersions.get(row.relationKey) : this.facts.get(knownKey)?.relationRevision;
      if (knownRevision !== undefined && knownRevision !== row.relationRevision) relationChanges.set(row.relationKey, key);
      stagedRelationVersions.set(row.relationKey, row.relationRevision);
    }
    // A complete Core closure is required before changing cross-source membership. Stage all pages privately.
    for (const [oldRelation, seedKey] of relationChanges) {
      const scope = new Set<string>(this.relations.get(oldRelation) ?? []); scope.add(seedKey);
      for (const [key, row] of staged) if (row.relationKey === oldRelation) scope.add(key);
      const relationStage = new Map<string, ProjectionRow>();
      const relationMissing = new Set<string>();
      try {
        const scopeIds = Array.from(scope).map((key: string): RemoteReadingIdentity => this.identity(key));
        await readBatch(scopeIds); current();
        for (const key of scope) {
          const partition = partitions.get(this.identity(key).sourceId);
          if (partition === undefined || !partition.valid) throw new Error('incomplete changed relation source');
          if (partition.missing.has(key)) relationMissing.add(key);
          const row = partition.rows.get(key); if (row !== undefined) relationStage.set(key, row);
        }
        const seenRelations = new Set<string>();
        for (const [key, row] of Array.from(relationStage)) {
          if (seenRelations.has(row.relationKey)) continue; seenRelations.add(row.relationKey);
          let cursor: string | undefined = undefined; let snapshot: string | undefined = undefined;
          do {
            const result = await request('search-book.related', { identity: this.identity(key), limit: 128, cursor }); current();
            if (!Array.isArray(result['books']) || !Array.isArray(result['sourceVersions']) || typeof result['complete'] !== 'boolean') throw new Error('invalid related projection');
            const observed = this.string(result, 'snapshotRevision');
            if (snapshot !== undefined && snapshot !== observed) throw new Error('related snapshot changed'); snapshot = observed;
            for (const raw of result['books']) {
              const related = this.decode(raw); const sourceId = this.string(related.row, 'origin');
              const source = sourceById.get(sourceId);
              const version = (result['sourceVersions'] as JsonObject[]).find((value: JsonObject): boolean => value['sourceId'] === sourceId);
              if (source === undefined || version?.['enabled'] !== true || version['sourceVersion'] !== source.sourceVersion ||
                related.relationKey !== row.relationKey || related.relationRevision !== row.relationRevision) throw new Error('related source/relation snapshot changed');
              const relatedKey = this.key(sourceId, this.string(related.row, 'bookUrl'));
              relationStage.set(relatedKey, related); captured.set(relatedKey, books.get(relatedKey));
            }
            const next = result['complete'] === true ? undefined : this.string(result, 'nextCursor');
            if (next !== undefined && (next.length === 0 || next === cursor)) throw new Error('nonadvancing related cursor'); cursor = next;
          } while (cursor !== undefined);
        }
        for (const key of relationMissing) removed.add(key);
        for (const [key, row] of relationStage) staged.set(key, row);
      } catch (error) {
        current(); diagnostics.push(error instanceof Error ? error.message : 'invalid relation partition');
        for (const key of scope) {
          // Healthy metadata may publish, but its old relation survives incomplete closure.
          const row = staged.get(key); const old = this.facts.get(key);
          if (row !== undefined && old !== undefined) staged.set(key, { row: row.row, relationKey: old.relationKey, relationRevision: old.relationRevision });
          else if (row !== undefined) staged.delete(key);
          removed.delete(key); retry.set(key, this.identity(key));
        }
      }
    }
    current();
    const relationSeeds = new Map<string, SearchBook>();
    for (const [key, row] of staged) { const book = books.get(key); if (book !== undefined) relationSeeds.set(row.relationKey, book); }
    const candidates = new Map<string, SearchBook>();
    const affected = new Set<string>();
    for (const key of removed) { const group = this.groupByIdentity.get(key); if (group !== undefined) for (const member of this.groups.get(group) ?? []) affected.add(member); }
    for (const [key, row] of staged) {
      const old = books.get(key); const oldFact = this.facts.get(key);
      const relatedMembers = this.relations.get(row.relationKey);
      const seedKey = relatedMembers?.values().next().value as string | undefined;
      const seed = old ?? (seedKey === undefined ? undefined : books.get(seedKey)) ?? relationSeeds.get(row.relationKey);
      // Unrelated cache changes do not grow this query.
      if (seed === undefined) continue;
      const source = sourceById.get(this.identity(key).sourceId); if (source === undefined) continue;
      try {
        const projected = this.project(row, source, old, seed);
        candidates.set(key, projected.admittedOrder === undefined ? { ...projected, admittedOrder: this.nextOrder++ } : projected); affected.add(key);
        if (oldFact === undefined || oldFact.relationKey !== row.relationKey) {
          for (const member of relatedMembers ?? []) affected.add(member);
          const group = this.groupByIdentity.get(key);
          if (group !== undefined) for (const member of this.groups.get(group) ?? []) affected.add(member);
        }
      } catch (_error) { retry.set(key, this.identity(key)); staged.delete(key); }
    }
    // Entire commit is synchronous. Published SearchBook objects are never mutated.
    this.initialized = true;
    for (const key of removed) {
      const old = this.facts.get(key); if (old !== undefined) this.relations.get(old.relationKey)?.delete(key);
      this.facts.delete(key);
    }
    for (const [key, candidate] of candidates) {
      const row = staged.get(key) as ProjectionRow;
      const old = this.facts.get(key); if (old !== undefined) this.relations.get(old.relationKey)?.delete(key);
      this.facts.set(key, row);
      let members = this.relations.get(row.relationKey); if (members === undefined) { members = new Set(); this.relations.set(row.relationKey, members); }
      members.add(key);
      this.nextOrder = Math.max(this.nextOrder, (candidate.admittedOrder ?? 0) + 1);
    }
    const components = new Map<string, string[]>();
    const survivingOwners = new Map<string, string>();
    for (const key of affected) {
      if (removed.has(key)) continue;
      const book = candidates.get(key) ?? books.get(key); if (book === undefined) continue;
      const relation = this.facts.get(key)?.relationKey ?? `identity:${key}`;
      const members = components.get(relation) ?? []; members.push(key); components.set(relation, members);
      const oldGroup = this.groupByIdentity.get(key) ?? book.groupKey;
      if (oldGroup !== undefined) {
        const owner = survivingOwners.get(oldGroup); const ownerBook = owner === undefined ? undefined : candidates.get(owner) ?? books.get(owner);
        if (ownerBook === undefined || (book.admittedOrder ?? 0) < (ownerBook.admittedOrder ?? 0)) survivingOwners.set(oldGroup, key);
      }
    }
    const upserted: SearchBook[] = [];
    for (const members of components.values()) {
      members.sort((a: string, b: string): number => ((candidates.get(a) ?? books.get(a))?.admittedOrder ?? 0) - ((candidates.get(b) ?? books.get(b))?.admittedOrder ?? 0));
      let groupKey: string | undefined = undefined;
      for (const key of members) {
        const book = candidates.get(key) ?? books.get(key) as SearchBook;
        const prior = this.groupByIdentity.get(key) ?? book.groupKey;
        if (prior !== undefined && survivingOwners.get(prior) === key) { groupKey = prior; break; }
      }
      groupKey = groupKey ?? `book:${members[0]}`;
      for (const key of members) {
        const original = books.get(key); const candidate = candidates.get(key) ?? original as SearchBook;
        const book: SearchBook = candidate.groupKey === groupKey ? candidate : { ...candidate, groupKey };
        const previousGroup = this.groupByIdentity.get(key); if (previousGroup !== undefined) this.groups.get(previousGroup)?.delete(key);
        this.groupByIdentity.set(key, groupKey);
        let group = this.groups.get(groupKey); if (group === undefined) { group = new Set(); this.groups.set(groupKey, group); } group.add(key);
        if (original === undefined || !this.same(original, book)) { captured.set(key, original); upserted.push(book); }
      }
    }
    for (const key of removed) {
      const group = this.groupByIdentity.get(key); if (group !== undefined) this.groups.get(group)?.delete(key);
      this.groupByIdentity.delete(key);
    }
    return { upserted, removedKeys: Array.from(removed), captured, retryIdentities: Array.from(retry.values()), diagnostics };
  }
}
